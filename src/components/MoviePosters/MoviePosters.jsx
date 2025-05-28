import React, { useEffect, useState, useRef } from 'react';
import Slider from 'react-slick';
import ColorThief from 'colorthief';
import Heading from '../../components/Heading/Heading';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import './MoviePosters.scss';

const MoviePosters = () => {
	const [movies, setMovies] = useState([]);
	const [loading, setLoading] = useState(true);
	const [currentMovie, setCurrentMovie] = useState(null);
	const sliderRef = useRef();
	const initialLogged = useRef(false);
	const [mainColors, setMainColors] = useState(['rgb(38,70,83)', 'rgb(42,157,143)']);
	const colorThief = useRef(new ColorThief());

	const cleanMovieTitle = (title) => {
		let cleanTitle = title.replace(/\s*\(\d{4}\)$/, '');
		cleanTitle = cleanTitle.replace(/\s*\(a\.k\.a\.\s+[^)]+\)/i, '');
		const articleRegex = /^(.+),\s+(The|A|An)$/;
		const match = cleanTitle.match(articleRegex);
		if (match) {
			cleanTitle = `${match[2]} ${match[1]}`;
		}
		return cleanTitle;
	};

	const getMainColorsFromImage = (imageUrl) => {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = 'Anonymous';
			img.src = imageUrl;

			img.onload = () => {
				try {
					const palette = colorThief.current.getPalette(img, 2);
					const colors = palette.map(color =>
						`rgb(${color[0]}, ${color[1]}, ${color[2]})`
					);
					resolve(colors);
				} catch (error) {
					console.error('ColorThief error:', error);
					resolve(['rgb(38,70,83)', 'rgb(42,157,143)']);
				}
			};

			img.onerror = () => {
				console.error('Error loading image');
				resolve(['rgb(38,70,83)', 'rgb(42,157,143)']);
			};
		});
	};

	const handleAfterChange = (current) => {
		const movie = movies[current];
		setCurrentMovie(movie);

		if (movie && movie.poster_path) {
			const imageUrl = `https://image.tmdb.org/t/p/w300${movie.poster_path}`;
			getMainColorsFromImage(imageUrl)
				.then(colors => {
					setMainColors(colors);
				})
				.catch(() => {
					setMainColors(['rgb(38,70,83)', 'rgb(42,157,143)']);
				});
		} else {
			setMainColors(['rgb(38,70,83)', 'rgb(42,157,143)']);
		}
	};

	useEffect(() => {
		if (!loading && movies.length > 0 && !initialLogged.current) {
			handleAfterChange(0);
			initialLogged.current = true;
		}
	}, [loading, movies]);

	useEffect(() => {
		const fetchRecommendations = async () => {
			try {
				setLoading(true);

				// Check for user authentication type
				const userId = localStorage.getItem('movieAppUserId');
				let requestBody;

				if (userId) {
					// ID-authenticated user - send empty object instead of null
					requestBody = {
						user_id: userId,
						ratings: {} // Changed from null to empty object
					};
					console.log("Fetching recommendations for ID-based user:", userId);
				} else {
					// Password-authenticated user - use localStorage ratings
					const storedRatings = JSON.parse(localStorage.getItem('movieRatings') || '{}');

					if (Object.keys(storedRatings).length === 0) {
						console.warn("No ratings found in localStorage");
						setLoading(false);
						return;
					}

					// Create a simplified format that API expects
					const formattedRatings = {};
					Object.entries(storedRatings).forEach(([movieId, data]) => {
						// Extract just the rating value from the stored object
						formattedRatings[movieId] = data.rating;
					});

					requestBody = {
						user_id: "anonymous",
						ratings: formattedRatings
					};
					console.log("Fetching recommendations for password user with local ratings");
				}

				// Send request to backend
				const response = await fetch('http://localhost:8000/api/recommendations', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(requestBody)
				});

				if (!response.ok) {
					throw new Error(`API responded with status: ${response.status}`);
				}

				const data = await response.json();
				const recommendedMovies = data.recommendations || [];

				// Enhance recommendations with TMDB data
				const apiKey = import.meta.env.VITE_TMDB_API_KEY;
				const updatedMovies = await Promise.all(
					recommendedMovies.map(async (movie) => {
						const predictedRating = (movie.predicted_rating * 100) / 20;
						
						try {
							const cleanTitle = cleanMovieTitle(movie.title);

							const response = await fetch(
								`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(cleanTitle)}&page=1`
							);
							const data = await response.json();
							const movieDetails = data.results[0] || {};

							return {
								...movie,
								title: cleanTitle,
								originalTitle: movie.title,
								id: movieDetails.id || movie.movieId,
								poster_path: movieDetails.poster_path || null,
								backdrop_path: movieDetails.backdrop_path || null,
								overview: movieDetails.overview || 'No overview available',
								predicted_rating: predictedRating
							};
						} catch (error) {
							console.error(`Error fetching details for movie ${movie.title}:`, error);
							return {
								...movie,
								title: cleanMovieTitle(movie.title),
								id: movie.movieId,
								poster_path: null,
								backdrop_path: null,
								overview: 'No overview available',
								predicted_rating: predictedRating
							};
						}
					})
				);

				setMovies(updatedMovies);
			} catch (error) {
				console.error('Error fetching recommendations:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchRecommendations();
	}, []);

	const sliderSettings = {
		dots: false,
		arrows: true,
		infinite: true,
		slidesToShow: 3,
		slidesToScroll: 1,
		autoplay: false,
		afterChange: handleAfterChange,
		focusOnSelect: true,
		responsive: [
			{
				breakpoint: 1024,
				settings: {
					slidesToShow: 2,
					slidesToScroll: 1
				}
			},
			{
				breakpoint: 600,
				settings: {
					slidesToShow: 1,
					slidesToScroll: 1
				}
			}
		]
	};

	return (
		<div
			className="movie-posters"
			style={{
				background: `linear-gradient(to right, 
				  ${mainColors[0].startsWith('rgba') ? mainColors[1] : mainColors[1].replace('#', 'rgba(').replace(')', ', 0)')},  
				  ${mainColors[0].startsWith('rgba') ? mainColors[0] : mainColors[0].replace('#', 'rgba(').replace(')', ', 1)')}, 
				  ${mainColors[1].startsWith('rgba') ? mainColors[0] : mainColors[0].replace('#', 'rgba(').replace(')', ', 1)')}
				)`,
				transition: 'background 0.5s'
			}}
		>
			<div className="movie-backdrop">
				{currentMovie && currentMovie.backdrop_path && (
					<img
						src={`https://image.tmdb.org/t/p/w1280${currentMovie.backdrop_path}`}
						alt={`${currentMovie.title} backdrop`}
						className="movie-backdrop"
					/>
				)}
			</div>
			<Heading level={1} className='heading-3 text-center main-heading'>Películas Recomendadas</Heading>
			{loading ? (
				<p>Loading movies...</p>
			) : (
				<div className="movies-slider">
					<Slider ref={sliderRef} {...sliderSettings}>
						{movies.map(movie => (
							<div key={movie.id} className="movie-card">
								{movie.poster_path ? (
									<div className="poster">
										<img
											src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
											alt={movie.title}
											className="movie-poster"
										/>
									</div>
								) : (
									<div className="no-poster">
										<Heading level={2} className='heading-3'>{movie.title}</Heading>
									</div>
								)}
							</div>
						))}
					</Slider>
					<div className="movie-details">
						<Heading level={3} className='heading-5 movie-title'>
							{currentMovie ? currentMovie.title : ''}
						</Heading>
						<p className="movie-overview">
							{currentMovie ? currentMovie.overview : ''}
						</p>
						<div className="movie-rating">
							{currentMovie?.actual_rating && (
								<p>Calificacion Actual: <span className="rating-value actual">{(currentMovie.actual_rating / 2).toFixed(1)}</span></p>
							)}
							{currentMovie?.predicted_rating && (
								<p>Calificacion Predicha: <span className="rating-value predicted">{currentMovie?.predicted_rating?.toFixed(1)}</span></p>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default MoviePosters;