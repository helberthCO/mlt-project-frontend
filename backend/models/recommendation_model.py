import pandas as pd
import numpy as np
import torch
import os
from typing import Dict, List, Tuple, Union
from models.data_processor import DataProcessor

class RecommendationModel:
    def __init__(self, data_processor: DataProcessor):
        """
        Inicializa el modelo de recomendación cargando el modelo pre-entrenado
        
        Args:
            data_processor: Instancia del procesador de datos
        """
        self.data_processor = data_processor
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model_path = os.path.join("data", "bert_gat_with_graphsage_finetuned.pt")
        
        # Preparar datos necesarios para hacer recomendaciones
        self._prepare_data()
        
        # Cargar el modelo pre-entrenado
        self.model = self._load_model()
    
    def _prepare_data(self):
        """Prepara los datos necesarios para las recomendaciones"""
        ratings_df = self.data_processor.ratings_df
        
        # Crear la matriz usuario-película
        user_movie_matrix = ratings_df.pivot(
            index='userId',
            columns='movieId',
            values='rating'
        ).fillna(0)
        
        # Guardar IDs de usuarios y películas
        self.user_ids = user_movie_matrix.index.tolist()
        self.movie_ids = user_movie_matrix.columns.tolist()
        
        # Crear mapeos para acceso rápido
        self.user_id_to_idx = {uid: idx for idx, uid in enumerate(self.user_ids)}
        self.movie_id_to_idx = {mid: idx for idx, mid in enumerate(self.movie_ids)}
        
        # Guardar la matriz para uso posterior
        self.user_movie_matrix = user_movie_matrix

    def _load_model(self):
        """Carga el modelo pre-entrenado desde el archivo"""
        try:
            print(f"Cargando modelo desde {self.model_path}")
            model_data = torch.load(self.model_path, map_location=self.device)
            print(f"Modelo cargado exitosamente. Tipo: {type(model_data)}")
            return model_data
        except Exception as e:
            raise RuntimeError(f"Error al cargar el modelo pre-entrenado: {str(e)}")
    
    def _get_user_vector(self, user_id: Union[str, int], user_ratings: Dict[str, float] = None) -> torch.Tensor:
        """
        Crea un vector de calificaciones para el usuario
        
        Args:
            user_id: ID del usuario o 'new' para usuario nuevo
            user_ratings: Diccionario de calificaciones para usuario nuevo
            
        Returns:
            Tensor con las calificaciones del usuario
        """
        # Inicializar vector de calificaciones con ceros
        user_vector = torch.zeros(len(self.movie_ids), dtype=torch.float32, device=self.device)
        
        # Caso 1: Usuario existente del dataset
        if isinstance(user_id, (str, int)) and str(user_id).isdigit() and int(user_id) in self.user_ids:
            user_idx = self.user_id_to_idx[int(user_id)]
            # Obtener calificaciones del usuario de la matriz
            for i, movie_id in enumerate(self.movie_ids):
                rating = self.user_movie_matrix.iloc[user_idx][movie_id]
                user_vector[i] = rating
        
        # Caso 2: Usuario nuevo con calificaciones proporcionadas
        elif user_ratings and len(user_ratings) > 0:
            # Llenar el vector con las calificaciones proporcionadas
            for movie_id_str, rating in user_ratings.items():
                if not str(movie_id_str).isdigit():
                    continue
                    
                movie_id = int(movie_id_str)
                if movie_id in self.movie_id_to_idx:
                    idx = self.movie_id_to_idx[movie_id]
                    user_vector[idx] = float(rating)
        
        # Si no se pudo construir un vector de calificaciones, usar películas populares
        if torch.sum(user_vector) == 0:
            print(f"No se encontraron calificaciones para el usuario {user_id}. Utilizando películas populares.")
            
            # Obtener las películas más populares basadas en el promedio de calificaciones
            popular_movies = self.data_processor.ratings_df.groupby('movieId')['rating'].mean().sort_values(ascending=False)
            
            # Asignar calificaciones "ficticias" a las 5 películas más populares
            for i, movie_id in enumerate(popular_movies.index[:5]):
                if movie_id in self.movie_id_to_idx:
                    idx = self.movie_id_to_idx[movie_id]
                    # Asignar calificación 5 a las películas más populares (como si al usuario le gustaran)
                    user_vector[idx] = 5.0
        
        return user_vector
    
    def _predict_with_model(self, user_vector: torch.Tensor) -> np.ndarray:
        """
        Realiza predicciones utilizando el modelo pre-entrenado
        
        Args:
            user_vector: Vector de calificaciones del usuario
            
        Returns:
            Array con puntuaciones de predicción para todas las películas
        """
        # Asegurarse de que el vector tiene la forma correcta
        if user_vector.dim() == 1:
            user_vector = user_vector.unsqueeze(0)  # Añadir dimensión de batch
        
        # Determinar cómo usar el modelo según su tipo
        if isinstance(self.model, torch.nn.Module):
            # Es un modelo PyTorch completo
            self.model.eval()
            with torch.no_grad():
                predictions = self.model(user_vector)
                return predictions.cpu().numpy().flatten()
                
        elif isinstance(self.model, dict):
            # Es un state_dict - extraer embeddings y hacer predicciones manuales
            # Buscar embeddings de películas
            item_embeddings = None
            for key, value in self.model.items():
                if 'item' in key.lower() and 'embedding' in key.lower():
                    item_embeddings = value
                    break
            
            if item_embeddings is None:
                raise ValueError("No se encontraron embeddings de películas en el modelo")
            
            # Crear representación del usuario
            rated_indices = torch.nonzero(user_vector[0]).flatten()
            if len(rated_indices) == 0:
                raise ValueError("El usuario no tiene calificaciones")
            
            user_profile = torch.zeros(item_embeddings.size(1), device=self.device)
            
            for idx in rated_indices:
                if idx < item_embeddings.size(0):
                    user_profile += user_vector[0, idx] * item_embeddings[idx]
            
            user_profile = user_profile / len(rated_indices)
            
            # Calcular similitud coseno entre perfil de usuario y embeddings de películas
            similarities = torch.zeros(len(self.movie_ids), device=self.device)
            
            for i in range(len(self.movie_ids)):
                if i < item_embeddings.size(0):
                    item_emb = item_embeddings[i]
                    # Similitud coseno
                    cos_sim = torch.dot(user_profile, item_emb) / (
                        torch.norm(user_profile) * torch.norm(item_emb) + 1e-8
                    )
                    similarities[i] = cos_sim
            
            return similarities.cpu().numpy()
        else:
            raise TypeError(f"Formato de modelo no soportado: {type(self.model)}")

    def get_recommendations(self, user_id: str, user_ratings: Dict[str, float] = None, 
                           top_k: int = 10, return_scores: bool = False) -> Union[List[str], Tuple[List[str], Dict[str, float]]]:
        """
        Obtiene recomendaciones para un usuario
        
        Args:
            user_id: ID del usuario
            user_ratings: Diccionario de calificaciones para usuario nuevo
            top_k: Número de recomendaciones a devolver
            return_scores: Si es True, devuelve también las puntuaciones
            
        Returns:
            Lista de IDs de películas recomendadas y opcionalmente un diccionario de puntuaciones
        """
        try:
            # Convertir calificaciones de usuario a diccionario si es necesario
            if user_ratings is None:
                user_ratings = {}
            
            # Obtener vector de calificaciones del usuario
            user_vector = self._get_user_vector(user_id, user_ratings)
            
            # Obtener predicciones del modelo
            predictions = self._predict_with_model(user_vector)
            
            # Determinar qué películas ya ha calificado el usuario
            rated_movies = set()
            
            if user_id.isdigit() and int(user_id) in self.user_ids:
                # Usuario existente
                user_idx = self.user_id_to_idx[int(user_id)]
                for i, movie_id in enumerate(self.movie_ids):
                    if self.user_movie_matrix.iloc[user_idx][movie_id] > 0:
                        rated_movies.add(i)
            else:
                # Usuario nuevo
                for movie_id_str in user_ratings.keys():
                    if str(movie_id_str).isdigit() and int(movie_id_str) in self.movie_id_to_idx:
                        movie_idx = self.movie_id_to_idx[int(movie_id_str)]
                        rated_movies.add(movie_idx)
            
            # Excluir películas ya calificadas
            for idx in rated_movies:
                if idx < len(predictions):
                    predictions[idx] = float('-inf')
            
            # Obtener los índices de las mejores predicciones
            top_indices = np.argsort(predictions)[::-1][:top_k]
            
            # Convertir índices a IDs de películas
            top_movie_ids = [str(self.movie_ids[idx]) for idx in top_indices if idx < len(self.movie_ids)]
            
            # Si no hay suficientes recomendaciones, completar con películas populares
            if len(top_movie_ids) < top_k:
                popular_movies = self.data_processor.ratings_df.groupby('movieId')['rating'].mean().sort_values(ascending=False)
                for movie_id in popular_movies.index:
                    movie_id_str = str(movie_id)
                    if movie_id_str not in top_movie_ids and movie_id_str not in user_ratings:
                        top_movie_ids.append(movie_id_str)
                        if len(top_movie_ids) >= top_k:
                            break
            
            # Limitar al número solicitado
            top_movie_ids = top_movie_ids[:top_k]
            
            # Crear diccionario de puntuaciones si se solicita
            if return_scores:
                scores = {}
                for i, movie_id in enumerate(top_movie_ids):
                    idx = self.movie_ids.index(int(movie_id)) if int(movie_id) in self.movie_ids else -1
                    if idx >= 0 and idx < len(predictions):
                        scores[movie_id] = float(predictions[idx])
                    else:
                        scores[movie_id] = 0.0
                return top_movie_ids, scores
            else:
                return top_movie_ids
                
        except Exception as e:
            print(f"Error al generar recomendaciones: {str(e)}")
            raise