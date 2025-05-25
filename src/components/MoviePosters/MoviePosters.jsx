import React, { useEffect, useState, useRef } from 'react';
import Slider from 'react-slick';
import ColorThief from 'colorthief';
import moviesData from '../../data/movies.json';
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
		const fetchMoviePosters = async () => {
			try {
				const apiKey = import.meta.env.VITE_TMDB_API_KEY;
				const updatedMovies = await Promise.all(
					moviesData.map(async (movie) => {
						const response = await fetch(
							`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&query=${encodeURIComponent(movie.title)}&page=1`
						);
						const data = await response.json();
						const movieDetails = data.results[0] || {};

						return {
							...movie,
							id: movieDetails.id || Math.random(),
							poster_path: movieDetails.poster_path || null,
							backdrop_path: movieDetails.backdrop_path || null,
							overview: movieDetails.overview || 'No overview available'
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
						src={`https://image.tmdb.org/t/p/w780${currentMovie.backdrop_path}`}
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
											src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
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
					</div>
				</div>
			)}
		</div>
	);
};

export default MoviePosters;