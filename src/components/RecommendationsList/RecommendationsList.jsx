import React, { useState, useEffect, useRef } from 'react';
import Heading from '../Heading/Heading';
import './RecommendationsList.scss';

const RecommendationsList = () => {
    const [displayedMovies, setDisplayedMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const MOVIES_PER_PAGE = 10;
    const initialFetchRef = useRef(false);

    // Clean movie titles function remains the same
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

    useEffect(() => {
        const initialFetch = async () => {
            if (initialFetchRef.current) return;

            setLoading(true);

            // First check user authentication type
            const userId = localStorage.getItem('movieAppUserId');
            const storedRatings = JSON.parse(localStorage.getItem('movieRatings') || '{}');

            let initialMovies = [];

            // If user has ID, use API regardless of localStorage content
            if (userId) {
                // User authenticated with ID - always use the API
                initialMovies = await fetchMovieBatch(1, MOVIES_PER_PAGE);
                console.log(`Fetched ${initialMovies.length} movies from API for user ${userId}`);
            } else {
                // Password authenticated user - use localStorage
                const hasStoredRatings = Object.keys(storedRatings).length > 0;

                if (hasStoredRatings) {
                    initialMovies = Object.entries(storedRatings).slice(0, MOVIES_PER_PAGE).map(([movieId, data]) => {
                        return {
                            movieId,
                            title: data.title || `Movie ${movieId}`,
                            rating: data.rating,
                            genre: data.genre,
                            poster_path: null
                        };
                    });

                    // Enhance with TMDB data
                    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
                    initialMovies = await Promise.all(
                        initialMovies.map(async (movie) => {
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
                                    id: movieDetails.id || movie.movieId,
                                    poster_path: movieDetails.poster_path || null
                                };
                            } catch (error) {
                                console.error(`Error fetching details for movie ${movie.title}:`, error);
                                return movie;
                            }
                        })
                    );

                    setHasMore(Object.keys(storedRatings).length > MOVIES_PER_PAGE);
                } else {
                    console.log("No ratings found for password-authenticated user");
                }
            }

            setDisplayedMovies(initialMovies);
            setLoading(false);
            initialFetchRef.current = true;
        };

        initialFetch();
    }, []);

    const fetchMovieBatch = async (pageNumber, pageLimit = 10) => {
        try {
            const userId = localStorage.getItem('movieAppUserId');
            if (!userId) {
                console.error('No user ID found in localStorage');
                return [];
            }

            // Fetch paginated user's rated movies
            const response = await fetch('http://localhost:8000/api/user_ratings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    page: pageNumber,
                    limit: pageLimit
                })
            });

            if (!response.ok) {
                throw new Error(`API responded with status: ${response.status}`);
            }

            const data = await response.json();
            const userRatings = data.ratings || [];
            const totalCount = data.total_count || 0;

            // Fetch movie details from TMDB
            const apiKey = import.meta.env.VITE_TMDB_API_KEY;
            const moviesWithDetails = await Promise.all(
                userRatings.map(async (movie) => {
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
                            rating: movie.rating
                        };
                    } catch (error) {
                        console.error(`Error fetching details for movie ${movie.title}:`, error);
                        return {
                            ...movie,
                            title: cleanMovieTitle(movie.title),
                            id: movie.movieId,
                            poster_path: null,
                            rating: movie.rating
                        };
                    }
                })
            );

            // Check if there are more movies to load
            setHasMore(userRatings.length === MOVIES_PER_PAGE &&
                (pageNumber * MOVIES_PER_PAGE) < totalCount);

            return moviesWithDetails;
        } catch (error) {
            console.error('Error fetching rated movies:', error);
            return [];
        }
    };

    const loadMoreMovies = async () => {
        if (loadingMore) return;
        setLoadingMore(true);

        const nextPage = page + 1;
        const userId = localStorage.getItem('movieAppUserId');
        let newMovies = [];

        if (userId) {
            // User with ID - use API
            newMovies = await fetchMovieBatch(nextPage);
        } else {
            // Password user - use localStorage
            const storedRatings = JSON.parse(localStorage.getItem('movieRatings') || '{}');
            const startIndex = (nextPage - 1) * MOVIES_PER_PAGE;
            const endIndex = startIndex + MOVIES_PER_PAGE;
            const entries = Object.entries(storedRatings).slice(startIndex, endIndex);

            if (entries.length === 0) {
                setHasMore(false);
                setLoadingMore(false);
                return;
            }

            // Process localStorage entries
            const localMovies = entries.map(([movieId, data]) => ({
                movieId,
                title: data.title || `Movie ${movieId}`,
                rating: data.rating,
                genre: data.genre,
                poster_path: null
            }));

            // Enhance with TMDB data
            const apiKey = import.meta.env.VITE_TMDB_API_KEY;
            newMovies = await Promise.all(
                localMovies.map(async (movie) => {
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
                            id: movieDetails.id || movie.movieId,
                            poster_path: movieDetails.poster_path || null
                        };
                    } catch (error) {
                        console.error(`Error fetching details for movie ${movie.title}:`, error);
                        return movie;
                    }
                })
            );

            setHasMore(endIndex < Object.keys(storedRatings).length);
        }

        setDisplayedMovies(prevMovies => [...prevMovies, ...newMovies]);
        setPage(nextPage);
        setLoadingMore(false);
    };

    return (
        <div className="rated-movies-container">
            <Heading level={1} className="heading-3 text-center">Películas Calificadas</Heading>

            {loading ? (
                <p className="loading">Cargando películas...</p>
            ) : (
                <>
                    <div className="rated-movies-grid">
                        {displayedMovies.length > 0 ? (
                            displayedMovies.map((movie, index) => (
                                <div key={`${movie.movieId}-${index}`} className="rated-movie-card">
                                    {movie.poster_path ? (
                                        <img
                                            src={`https://image.tmdb.org/t/p/w300${movie.poster_path}`}
                                            alt={movie.title}
                                            className="movie-poster"
                                        />
                                    ) : (
                                        <div className="no-poster">
                                            <p>{movie.title}</p>
                                        </div>
                                    )}
                                    <div className="movie-info">
                                        <h3 className="movie-title">{movie.title}</h3>
                                        <div className="rating">
                                            <span>Calificación: {movie.rating}</span>
                                            <div className="stars-container">
                                                {[...Array(5)].map((_, i) => {
                                                    if (i < Math.floor(movie.rating)) {
                                                        return <span key={i} className="star filled">★</span>;
                                                    } else if (i === Math.floor(movie.rating) && movie.rating % 1 >= 0.5) {
                                                        return <span key={i} className="star half-filled">★</span>;
                                                    } else {
                                                        return <span key={i} className="star">★</span>;
                                                    }
                                                })}
                                            </div>
                                        </div>
                                        <div className="movie-id">
                                            <small>ID: {movie.movieId}</small>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="no-ratings">No has calificado películas aún.</p>
                        )}
                    </div>

                    {hasMore && (
                        <div className="load-more-container">
                            <button
                                className="load-more-button"
                                onClick={loadMoreMovies}
                                disabled={loadingMore}
                            >
                                {loadingMore ? 'Cargando...' : 'Cargar más películas'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default RecommendationsList;