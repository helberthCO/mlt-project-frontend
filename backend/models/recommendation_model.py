import pandas as pd
import numpy as np
from typing import Dict, List
from scipy.sparse.linalg import svds
from models.data_processor import DataProcessor

class RecommendationModel:
    def __init__(self, data_processor: DataProcessor):
        self.data_processor = data_processor
        self._train_model()

    def _train_model(self):
        """Train the recommendation model on the dataset"""
        ratings_df = self.data_processor.ratings_df

        # Create a user-movie matrix
        user_movie_matrix = ratings_df.pivot(
            index='userId',
            columns='movieId',
            values='rating'
        ).fillna(0)

        self.user_ids = user_movie_matrix.index.tolist()
        self.movie_ids = user_movie_matrix.columns.tolist()
        self.movie_id_map = {i: str(movie_id) for i, movie_id in enumerate(self.movie_ids)}

        # Calculate user-movie matrix
        matrix = user_movie_matrix.values
        user_ratings_mean = np.mean(matrix, axis=1)
        matrix_normalized = matrix - user_ratings_mean.reshape(-1, 1)

        # Singular Value Decomposition
        U, sigma, Vt = svds(matrix_normalized, k=min(50, min(matrix.shape) - 1))

        # Convert to diagonal matrix
        sigma_diag_matrix = np.diag(sigma)

        # Calculate prediction matrix
        self.predicted_ratings = np.dot(np.dot(U, sigma_diag_matrix), Vt) + user_ratings_mean.reshape(-1, 1)

        # Store mean ratings for new user predictions
        self.global_mean_rating = ratings_df['rating'].mean()
        self.item_means = ratings_df.groupby('movieId')['rating'].mean().to_dict()

    def get_recommendations(self, user_id, user_ratings=None, top_k=10, return_scores=False):
        """
        Get top movie recommendations for a user

        Args:
            user_id: User identifier
            user_ratings: Dictionary of movieId -> rating
            top_k: Number of recommendations to return
            return_scores: Whether to return the predicted ratings alongside recommendations
        """
        # Initialize dictionary to store predicted ratings for all candidates`
        predicted_ratings = {}

        # Check if this is an existing user in our dataset
        if user_id.isdigit() and int(user_id) in self.user_ids:
            # Get the index of this user
            user_index = self.user_ids.index(int(user_id))

            # Get predicted ratings for this user
            user_predicted_ratings = self.predicted_ratings[user_index]

            # Create predictions dataframe
            predictions = pd.DataFrame({
                'movieId': self.movie_ids,
                'predictedRating': user_predicted_ratings
            })

            # Get movies the user has already rated
            rated_movies = [int(movie_id) for movie_id in user_ratings.keys() if movie_id.isdigit()]

            # Filter out already rated movies
            recommendations = predictions[~predictions['movieId'].isin(rated_movies)]

            # Store all predicted ratings in our dictionary
            for _, row in predictions.iterrows():
                movie_id = str(row['movieId'])
                predicted_ratings[movie_id] = float(row['predictedRating'])

        else:
            # For new users, use item-based approach
            movie_scores = {}

            # Calculate similarity to rated movies
            for movie_id, rating in user_ratings.items():
                if not str(movie_id).isdigit() or int(movie_id) not in self.movie_ids:
                    continue

                movie_index = self.movie_ids.index(int(movie_id))
                movie_vector = self.predicted_ratings[:, movie_index]

                for i, other_movie_id in enumerate(self.movie_ids):
                    if other_movie_id != int(movie_id) and str(other_movie_id) not in user_ratings:
                        other_movie_vector = self.predicted_ratings[:, i]

                        # Calculate similarity
                        similarity = np.dot(movie_vector, other_movie_vector) / (
                                np.linalg.norm(movie_vector) * np.linalg.norm(other_movie_vector)
                        )

                        # Update score
                        if str(other_movie_id) not in movie_scores:
                            movie_scores[str(other_movie_id)] = 0

                        movie_scores[str(other_movie_id)] += similarity * (rating - self.global_mean_rating)

            # Update predicted ratings with calculated scores
            for movie_id, score in movie_scores.items():
                # Adjust the score to be on the same scale as ratings (1-5)
                adjusted_score = self.global_mean_rating + score
                # Clip to valid rating range
                adjusted_score = max(0.5, min(5.0, adjusted_score))
                predicted_ratings[movie_id] = adjusted_score

            # Sort movies by score
            recommendations = pd.DataFrame({
                'movieId': list(movie_scores.keys()),
                'predictedRating': list(movie_scores.values())
            })

        # Ensure unique movieIds in recommendations
        recommendations = recommendations.drop_duplicates(subset=['movieId'])

        # Get more candidates for diversity (5x instead of 3x)
        top_candidates = recommendations.sort_values(
            by='predictedRating',
            ascending=False
        ).head(min(top_k * 5, len(recommendations)))

        # If we have more candidates than needed, select a diverse set
        if len(top_candidates) > top_k:
            # Increase randomization factor for more diversity
            top_candidates['diversityScore'] = top_candidates['predictedRating'] + np.random.normal(0, 0.2, size=len(top_candidates))
            final_recs = top_candidates.sort_values(by='diversityScore', ascending=False).head(top_k)
        else:
            final_recs = top_candidates.head(top_k)

        # Ensure we have unique recommendations
        result = final_recs['movieId'].astype(str).tolist()

        # Double-check uniqueness (just in case)
        result = list(dict.fromkeys(result))

        # If we don't have enough recommendations, add more from the sorted list
        if len(result) < top_k:
            remaining = recommendations[~recommendations['movieId'].astype(str).isin(result)]
            sorted_remaining = remaining.sort_values(by='predictedRating', ascending=False)

            # Add more recommendations until we reach top_k or run out of options
            additional = sorted_remaining['movieId'].astype(str).tolist()[:top_k - len(result)]
            result.extend(additional)

        # Make sure predicted_ratings uses the SAME IDs as recommendation_ids
        corrected_predictions = {}
        for movie_id in result:  # result contains the recommended movie IDs
            if movie_id in predicted_ratings:
                corrected_predictions[str(movie_id)] = predicted_ratings[movie_id]
            else:
                # Attempt to find with different format
                str_id = str(movie_id)
                corrected_predictions[str_id] = predicted_ratings.get(str_id, 0.0)

        if return_scores:
            return result[:top_k], corrected_predictions
        else:
            return result[:top_k]