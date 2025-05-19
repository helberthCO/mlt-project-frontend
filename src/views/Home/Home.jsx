import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Heading from '../../components/Heading/Heading';
import Header from '../../components/Header/Header';
import MoviePosters from '../../components/MoviePosters/MoviePosters';
import './Home.scss';

const Home = () => {
	const navigate = useNavigate();

	useEffect(() => {
		// Check if user is authenticated
		const token = sessionStorage.getItem('authToken');
		if (!token) {
			navigate('/login');
		}
	}, [navigate]);

	return (
		<div className="home-view">
			<Header />
			<div className="home-content">
				<Heading level={1} className='heading-3 text-center'>Películas Recomendadas</Heading>
				<MoviePosters/>
			</div>
		</div>
	);
};

export default Home;