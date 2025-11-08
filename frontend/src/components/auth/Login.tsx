import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Alert, InputAdornment } from '@mui/material';
import { Person, Lock, ArrowForward } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import loginImage from '../../assets/AdobeStock_307109106.jpeg';
import './Login.css';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
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
    setFormData({
      ...formData,
      [e.target.name]: value
    });
    setError('');
    
    if (e.target.name === 'password' && !isLogin) {
      const errors = validatePassword(value);
      setPasswordErrors(errors);
      // Check if passwords match when password changes
      if (formData.confirmPassword && value !== formData.confirmPassword) {
        setPasswordMatchError('Passwords do not match');
      } else if (formData.confirmPassword && value === formData.confirmPassword) {
        setPasswordMatchError('');
      }
    } else if (e.target.name === 'confirmPassword' && !isLogin) {
      // Check if passwords match when confirm password changes
      if (value !== formData.password) {
        setPasswordMatchError('Passwords do not match');
      } else {
        setPasswordMatchError('');
      }
    } else if (e.target.name === 'password' && isLogin) {
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
          Mom Meal Manager
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
                {loading ? 'Loading...' : 'Login'}
              </Button>
            </Box>
            
            <Button
              fullWidth
              variant="text"
              onClick={() => setIsLogin(!isLogin)}
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
