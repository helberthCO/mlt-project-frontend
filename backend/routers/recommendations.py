from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Optional
from pydantic import BaseModel
import pandas as pd
import os
from models.data_processor import DataProcessor
from models.recommendation_model import RecommendationModel

router = APIRouter()
data_processor = DataProcessor()
recommendation_model = RecommendationModel(data_processor)

# Load ratings data
ratings_path = os.path.join(data_processor.data_dir, 'ratings.csv')
ratings_df = pd.read_csv(ratings_path) if os.path.exists(ratings_path) else pd.DataFrame()

class UserRatingsInput(BaseModel):
    user_id: str
    ratings: Optional[Dict[str, float]] = None

class RecommendationResponse(BaseModel):
    recommendations: List[Dict]

@router.post("/validate-id", response_model=Dict)
async def validate_user_id(user_id: int):
    """Validate if a user ID exists in the dataset"""
    if ratings_df.empty:
        raise HTTPException(status_code=404, detail="Ratings data not available")

    user_exists = user_id in ratings_df['userId'].values
    max_user_id = int(ratings_df['userId'].max())

    return {
        "valid": user_exists,
        "maxUserId": max_user_id
    }

@router.post("/recommendations", response_model=RecommendationResponse)
async def get_recommendations(input_data: UserRatingsInput):
    """Get movie recommendations for a user"""
    user_id = input_data.user_id
    user_ratings = input_data.ratings or {}

    # Get recommendations with predicted ratings
    recommendation_ids, predicted_ratings = recommendation_model.get_recommendations(
        user_id=user_id,
        user_ratings=user_ratings,
        top_k=10,
        return_scores=True
    )

    # Get detailed information for recommended movies
    movie_details = data_processor.get_movie_details(recommendation_ids)

    # More explicit and direct matching approach
    for movie in movie_details:
        movie_id = str(movie.get('movieId', movie.get('id')))
        rating_value = predicted_ratings.get(movie_id)

        # Direct access with exact key
        if movie_id in predicted_ratings:
            movie['predicted_rating'] = predicted_ratings[movie_id]
        else:
            movie['predicted_rating'] = None

        movie['actual_rating'] = movie.get('vote_average')

    return {"recommendations": movie_details}