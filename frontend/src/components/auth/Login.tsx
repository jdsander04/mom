import React, { useState, useEffect } from 'react';
import { Box, TextField, Button, Typography, Alert, InputAdornment } from '@mui/material';
import { Person, Lock, ArrowForward } from '@mui/icons-material';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import loginImage from '../../assets/AdobeStock_307109106.jpeg';
import momCartImage from '../../assets/mom-cart.png';
import './Login.css';

const Login: React.FC = () => {
  const location = useLocation();
  const initialMode = (location.state as { initialMode?: 'login' | 'signup' })?.initialMode || 'login';
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  
  useEffect(() => {
    setIsLogin(initialMode === 'login');
  }, [initialMode]);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [passwordMatchError, setPasswordMatchError] = useState('');
  const [maxLengthError, setMaxLengthError] = useState<string | null>(null);
  const { login, signup } = useAuth();

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    return errors;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const fieldName = e.target.name;
    const maxLength = fieldName === 'email' ? 50 : 30;
    
    // Check if max length is reached
    if (value.length >= maxLength) {
      const fieldLabel = fieldName === 'email' ? 'Email' : 
                        fieldName === 'username' ? 'Username' : 
                        fieldName === 'password' ? 'Password' : 'Re-enter Password';
      setMaxLengthError(`${fieldLabel} has reached the maximum length of ${maxLength} characters`);
    } else {
      setMaxLengthError(null);
    }
    
    setFormData({
      ...formData,
      [fieldName]: value
    });
    setError('');
    
    if (fieldName === 'password' && !isLogin) {
      const errors = validatePassword(value);
      setPasswordErrors(errors);
      // Check if passwords match when password changes
      if (formData.confirmPassword && value !== formData.confirmPassword) {
        setPasswordMatchError('Passwords do not match');
      } else if (formData.confirmPassword && value === formData.confirmPassword) {
        setPasswordMatchError('');
      }
    } else if (fieldName === 'confirmPassword' && !isLogin) {
      // Check if passwords match when confirm password changes
      if (value !== formData.password) {
        setPasswordMatchError('Passwords do not match');
      } else {
        setPasswordMatchError('');
      }
    } else if (fieldName === 'password' && isLogin) {
      setPasswordErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLogin) {
      const errors = validatePassword(formData.password);
      if (errors.length > 0) {
        setPasswordErrors(errors);
        setError('Please fix password validation errors');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setPasswordMatchError('Passwords do not match');
        setError('Passwords do not match');
        return;
      }
    }
    
    setLoading(true);
    setError('');
    setPasswordErrors([]);
    setPasswordMatchError('');
    setMaxLengthError(null);

    try {
      if (isLogin) {
        await login(formData.username, formData.password);
      } else {
        await signup(formData.username, formData.password, formData.email);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box className="login-container">
      <Box 
        className="login-left-panel"
        sx={{
          '--login-bg-image': `url(${loginImage})`,
        } as React.CSSProperties}
      >
        <Box className="branding-text">
          <img src={momCartImage} alt="Mom Cart" className="branding-image" />
          Mom
        </Box>
        
        <Box className="copyright-text">
          © 2025 Mom. All Rights Reserved.
        </Box>
        
        <Box className="decorative-shapes">
          <Box className="shape shape-1" />
          <Box className="shape shape-2" />
          <Box className="shape shape-3" />
        </Box>
      </Box>
      
      <Box className="login-right-panel">
        <Box className="login-form-card">
          <Typography variant="h4" className="login-title">
            {isLogin ? 'Login' : 'Sign Up'}
          </Typography>
          
          {error && <Alert severity="error" sx={{ mb: 2, mt: 2 }}>{error}</Alert>}
          {maxLengthError && <Alert severity="error" sx={{ mb: 2, mt: 2 }}>{maxLengthError}</Alert>}
          
          <form onSubmit={handleSubmit} className="login-form">
            <Box className="input-wrapper">
              <Typography variant="body2" className="input-label">
                Username
              </Typography>
              <Box className={`input-container ${focusedField === 'username' ? 'focused' : ''}`}>
                <TextField
                  fullWidth
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  variant="standard"
                  className="modern-input"
                  required
                  inputProps={{ maxLength: 30 }}
                  InputProps={{
                    disableUnderline: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Person className="input-icon" />
                      </InputAdornment>
                    ),
                  }}
                />
                <Box className="input-underline" />
              </Box>
            </Box>
            
            {!isLogin && (
              <Box className="input-wrapper">
                <Typography variant="body2" className="input-label">
                  Email
                </Typography>
                <Box className={`input-container ${focusedField === 'email' ? 'focused' : ''}`}>
                  <TextField
                    fullWidth
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    variant="standard"
                    className="modern-input"
                    required
                    inputProps={{ maxLength: 50 }}
                    InputProps={{
                      disableUnderline: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <Person className="input-icon" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Box className="input-underline" />
                </Box>
              </Box>
            )}
            
            <Box className="input-wrapper">
              <Typography variant="body2" className="input-label">
                Password
              </Typography>
              <Box className={`input-container ${focusedField === 'password' ? 'focused' : ''}`}>
                <TextField
                  fullWidth
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  variant="standard"
                  className="modern-input"
                  required
                  error={!isLogin && passwordErrors.length > 0}
                  inputProps={{ maxLength: 30 }}
                  InputProps={{
                    disableUnderline: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Lock className="input-icon" />
                      </InputAdornment>
                    ),
                  }}
                />
                <Box className={`input-underline ${!isLogin && passwordErrors.length > 0 ? 'error' : ''}`} />
              </Box>
              {!isLogin && passwordErrors.length > 0 && (
                <Box className="password-errors">
                  {passwordErrors.map((err, index) => (
                    <Typography key={index} variant="caption" className="password-error-text">
                      {err}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
            
            {!isLogin && (
              <Box className="input-wrapper">
                <Typography variant="body2" className="input-label">
                  Re-enter Password
                </Typography>
                <Box className={`input-container ${focusedField === 'confirmPassword' ? 'focused' : ''}`}>
                  <TextField
                    fullWidth
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('confirmPassword')}
                    onBlur={() => setFocusedField(null)}
                    variant="standard"
                    className="modern-input"
                    required
                    error={passwordMatchError.length > 0}
                    inputProps={{ maxLength: 30 }}
                    InputProps={{
                      disableUnderline: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <Lock className="input-icon" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Box className={`input-underline ${passwordMatchError.length > 0 ? 'error' : ''}`} />
                </Box>
                {passwordMatchError && (
                  <Typography variant="caption" className="password-error-text" sx={{ mt: 0.5 }}>
                    {passwordMatchError}
                  </Typography>
                )}
              </Box>
            )}
            
            <Box className="forgot-password-row">
              <Typography 
                variant="body2" 
                className="forgot-password-link"
                onClick={() => {/* Handle forgot password */}}
                sx={{ cursor: 'pointer' }}
              >
                Forgot password? <span className="reset-text">Reset</span>
              </Typography>
              <Button
                type="submit"
                variant="contained"
                className="login-button"
                disabled={loading}
                endIcon={<ArrowForward />}
              >
                {loading ? 'Loading...' : (isLogin ? 'Login' : 'Sign Up')}
              </Button>
            </Box>
            
            <Button
              fullWidth
              variant="text"
              onClick={() => {
                setIsLogin(!isLogin);
                setMaxLengthError(null);
              }}
              className="toggle-auth-button"
              sx={{ mt: 2 }}
            >
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
            </Button>
          </form>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
