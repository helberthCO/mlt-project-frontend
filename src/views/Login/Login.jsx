import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Heading from '../../components/Heading/Heading';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import Paragraph from '../../components/Paragraph/Paragraph';
import { initDB, registerUser, loginUser } from '../../services/db.service';
import './Login.scss';

const Login = () => {
	const navigate = useNavigate();
	const [isLogin, setIsLogin] = useState(true);
	const [formData, setFormData] = useState({
		name: '',
		username: '',
		password: ''
	});
	const [error, setError] = useState('');
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	useEffect(() => {
		// Initialize the database when component mounts
		initDB();

		// Check if user is already authenticated
		const token = sessionStorage.getItem('authToken');
		if (token) {
			setIsAuthenticated(true);
			// Redirect to home page if already authenticated
			navigate('/');
		}
	}, [navigate]);

	const generateToken = (user) => {
		// In a real app, this would be a JWT from your backend
		// This is a simple token for demo purposes
		const timestamp = new Date().getTime();
		return btoa(`${user.username}:${timestamp}`); // Simple base64 encoding
	};

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData({
			...formData,
			[name]: value
		});
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');

		try {
			if (isLogin) {
				if (!formData.username || !formData.password) {
					setError('Please enter both username and password');
					return;
				}

				const user = await loginUser(formData.username, formData.password);
				const token = generateToken(user);
				sessionStorage.setItem('authToken', token);
				sessionStorage.setItem('userData', JSON.stringify({
					username: user.username,
					name: user.name
				}));

				setIsAuthenticated(true);
				console.log('Login successful!', user);

				// Redirect to home after successful login
				navigate('/');
			} else {
				if (!formData.name || !formData.username || !formData.password) {
					setError('Please fill in all fields');
					return;
				}

				await registerUser({
					name: formData.name,
					username: formData.username,
					password: formData.password,
					createdAt: new Date().toISOString()
				});

				console.log('Registration successful!');
				setIsLogin(true); // Switch to login form after successful registration
			}
		} catch (err) {
			setError(err.toString());
		}
	};

	const toggleMode = () => {
		setIsLogin(!isLogin);
		setError('');
	};

	return (
		<div className="login-view">
			<div className="login-container">
				<Heading level={2} className='heading-1 text-center'>{isLogin ? 'Bievenido' : 'Regístate'}</Heading>
				<Paragraph className="heading-context text-center">Por favor ingresa tus datos a continiación</Paragraph>

				{error && <Paragraph className="error">{error}</Paragraph>}

				<form onSubmit={handleSubmit}>
					{!isLogin && (
						<Input
							type="text"
							placeholder="Nombre"
							name="name"
							label="Nombre Completo"
							value={formData.name}
							onChange={handleChange}
						/>
					)}

					<Input
						type="text"
						placeholder="Usuario"
						name="username"
						label="Nombre de Usuario"
						value={formData.username}
						onChange={handleChange}
					/>

					<Input
						type="password"
						placeholder="Contraseña"
						name="password"
						label="Contraseña"
						value={formData.password}
						onChange={handleChange}
					/>

					<Button type="submit" className="submit-button">
						{isLogin ? 'Iniciar Sesión' : 'Registrarse'}
					</Button>
				</form>

				<Paragraph className="toggle-form text-center">
					{isLogin ? "¿No tienes una cuenta? " : "¿Ya tienes una cuenta? "}
					<span onClick={toggleMode} className="toggle-link">
                        {isLogin ? 'Regístate aquí' : 'Inicia sesión aquí'}
                    </span>
				</Paragraph>
			</div>
		</div>
	);
};

export default Login;