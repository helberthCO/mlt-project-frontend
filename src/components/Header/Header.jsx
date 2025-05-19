import React from 'react';
import { useNavigate } from 'react-router-dom';
import Heading from '../Heading/Heading';
import Button from '../Button/Button';
import Paragraph from '../Paragraph/Paragraph';
import './Header.scss';

const Header = () => {
	const navigate = useNavigate();
	const userData = JSON.parse(sessionStorage.getItem('userData')) || { name: 'Usuario' };

	const handleLogout = () => {
		sessionStorage.removeItem('authToken');
		sessionStorage.removeItem('userData');
		navigate('/login');
	};

	return (
		<header className="app-header">
			<div className="header-content">
				<div className="welcome-section">
					<Heading level={3}>Bienvenido, {userData.name}</Heading>
				</div>
				<div className="header-actions">
					<Button className="profile">Perfil</Button>
					<Button onClick={handleLogout} className="logout-button">Cerrar Sesión</Button>
				</div>
			</div>
		</header>
	);
};

export default Header;