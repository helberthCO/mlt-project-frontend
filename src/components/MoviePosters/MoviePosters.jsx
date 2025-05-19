import React, { useEffect, useState } from 'react';
import Slider from 'react-slick';
import moviesData from '../../data/movies.json';
import Heading from '../../components/Heading/Heading';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import './MoviePosters.scss';

const MoviePosters = () => {
	const [movies, setMovies] = useState([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchMoviePosters = async () => {
			try {
				const apiKey = import.meta.env.VITE_TMDB_API_KEY;
				const updatedMovies = await Promise.all(
					moviesData.map(async (movie) => {
						const response = await fetch(
							`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(movie.title)}&page=1`
						);
						const data = await response.json();

						// Get the first result (most relevant match)
						const movieDetails = data.results[0] || {};
						return {
							...movie,
							id: movieDetails.id || Math.random(),
							poster_path: movieDetails.poster_path || null
						};
					})
				);
				setMovies(updatedMovies);
			} catch (error) {
				console.error('Error fetching movie posters:', error);
			} finally {
				setLoading(false);
			}
		};

		fetchMoviePosters();
	}, []);

	const sliderSettings = {
		dots: false,
		arrows: true,
		infinite: true,
		slidesToShow: 5,
		slidesToScroll: 1,
		autoplay: false,
		responsive: [
			{
				breakpoint: 1024,
				settings: {
					slidesToShow: 3,
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
		<>
			{loading ? (
				<p>Loading movies...</p>
			) : (
				<div className="movies-slider">
					<Slider {...sliderSettings}>
						{movies.map(movie => (
							<div key={movie.id} className="movie-card">
								{movie.poster_path ? (
									<div className="poster">
										<img
											src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
											alt={movie.title}
											className="movie-poster"
										/>
										<Heading level={3} className='heading-5 movie-title'>{movie.title}</Heading>
									</div>
								) : (
									<div className="no-poster">
										<Heading level={2} className='heading-3'>{movie.title}</Heading>
									</div>
								)}
							</div>
						))}
					</Slider>
				</div>
			)}
		</>
	);
};

export default MoviePosters;