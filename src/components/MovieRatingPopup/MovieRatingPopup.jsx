import React, { useEffect, useState } from 'react';
import { auth, db, saveMovieRating, updateUserRatingStatus } from '../../services/firebase.service';
import Heading from '../Heading/Heading';
import Button from '../Button/Button';
import Paragraph from '../Paragraph/Paragraph';
import './MovieRatingPopup.scss';

const MovieRatingPopup = () => {
	const [movies, setMovies] = useState([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [ratings, setRatings] = useState({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const MOVIES_TO_RATE = 5;

	useEffect(() => {
		const fetchMovies = async () => {
			try {
				const response = await fetch(
					`https://api.themoviedb.org/3/movie/popular?api_key=${import.meta.env.VITE_TMDB_API_KEY}`
				);

				if (!response.ok) throw new Error('Failed to fetch movies');

				const data = await response.json();
				// Get random selection of movies
				const randomMovies = data.results
					.sort(() => 0.5 - Math.random())
					.slice(0, 10);

				setMovies(randomMovies);
			} catch (err) {
				console.error('Error fetching movies:', err);
				setError('Failed to load movies');
			} finally {
				setLoading(false);
			}
		};

		fetchMovies();
	}, []);

	const handleRateMovie = async (rating) => {
		const currentMovie = movies[currentIndex];

		// Save rating
		const newRatings = { ...ratings, [currentMovie.id]: rating };
		setRatings(newRatings);

		try {
			// Save to Firebase
			await saveMovieRating(auth.currentUser.uid, currentMovie.id, rating);

			// Move to next movie or finish
			if (currentIndex < MOVIES_TO_RATE - 1) {
				setCurrentIndex(currentIndex + 1);
			} else {
				// Update user status and reload the page
				await updateUserRatingStatus(auth.currentUser.uid, true);
				window.location.reload();
			}
		} catch (err) {
			setError('Failed to save rating');
			console.error(err);
		}
	};

	if (loading) return (
		<div className="movie-rating-container">
			<Heading level={2}>Loading movies...</Heading>
		</div>
	);

	if (error) return (
		<div className="movie-rating-container">
			<Heading level={2}>{error}</Heading>
		</div>
	);

	const currentMovie = movies[currentIndex];

	return (
		<div className="movie-rating-container">
			<Heading level={2} className='main-heading'>Rate Movies to Get Started</Heading>
			<Paragraph>Rate {MOVIES_TO_RATE} movies so we can recommend titles for you!</Paragraph>

			<div className="rating-progress">
				<Paragraph>Movie {currentIndex + 1} of {MOVIES_TO_RATE}</Paragraph>
			</div>

			<div className="movie-card">
				<Heading level={3}>{currentMovie.title}</Heading>

				<div className="movie-details">
					{currentMovie.poster_path ? (
						<img
							src={`https://image.tmdb.org/t/p/w500${currentMovie.poster_path}`}
							alt={currentMovie.title}
							className="movie-poster"
						/>
					) : (
						<div className="no-poster">No image available</div>
					)}

					<div className="movie-info">
						<Paragraph>{currentMovie.overview}</Paragraph>
					</div>
				</div>
			</div>

			<div className="rating-buttons">
				<Paragraph>Your Rating:</Paragraph>
				<div className="stars">
					{[1, 2, 3, 4, 5].map(star => (
						<Button
							key={star}
							onClick={() => handleRateMovie(star)}
							className="rating-btn"
						>
							{star}★
						</Button>
					))}
				</div>
			</div>
		</div>
	);
};

export default MovieRatingPopup;