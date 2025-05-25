import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../services/firebase.service';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Header from '../../components/Header/Header';
import MoviePosters from '../../components/MoviePosters/MoviePosters';
import MovieRatingPopup from '../../components/MovieRatingPopup/MovieRatingPopup';
import './Home.scss';

const Home = () => {
	const navigate = useNavigate();
	const [isLoading, setIsLoading] = useState(true);
	const [hasRatedMovies, setHasRatedMovies] = useState(false);

	useEffect(() => {
		// Use a single listener to prevent multiple redirects
		const unsubscribe = onAuthStateChanged(auth, async (user) => {
			if (!user) {
				// Only navigate once when user is not authenticated
				navigate('/login', { replace: true });
			} else {
				try {
					const userDoc = await getDoc(doc(db, 'users', user.uid));
					if (userDoc.exists()) {
						const userData = userDoc.data();
						setHasRatedMovies(userData.hasRatedMovies || false);
					}
				} catch (error) {
					console.error("Error fetching user rating status:", error);
				}
			}
			setIsLoading(false);
		});

		return () => unsubscribe();
	}, [navigate]);

	if (isLoading) {
		return <div>Loading...</div>;
	}

	return (
		<div className="home-view">
			{hasRatedMovies ? (
				<>
					<Header />
					<div className="home-content">
						<MoviePosters />
					</div>
				</>
			) : (
				<>
					<MovieRatingPopup />
				</>
			)}
		</div>
	);
};

export default Home;