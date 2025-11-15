import { useNavigate } from 'react-router-dom';
import { Button, Box, Typography, Container } from '@mui/material';
import momCartImage from '../../assets/mom-cart.png';
import foodImage from '../../assets/AdobeStock_307109106.jpeg';
import handwrittenRecipeImage from '../../assets/hand-written-recipes-card.jpeg';
import phoneImage from '../../assets/phone-transparent.png';
import styles from './LandingPage.module.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const handleSignUp = () => {
    navigate('/login', { state: { initialMode: 'signup' } });
  };

  const handleLogin = () => {
    navigate('/login', { state: { initialMode: 'login' } });
  };

  return (
    <Box 
      className={styles.pageWrapper}
      sx={{
        fontFamily: "'Lexend', sans-serif",
        '& *': {
          fontFamily: "'Lexend', sans-serif !important"
        },
        '& .MuiTypography-root': {
          fontFamily: "'Lexend', sans-serif !important"
        },
        '& .MuiButton-root': {
          fontFamily: "'Lexend', sans-serif !important"
        }
      }}
    >
      <Box 
        className={styles.landingContainer}
        sx={{
          '--food-bg-image': `url(${foodImage})`,
        } as React.CSSProperties}
      >
        <Box className={styles.overlay} />
        <Box className={styles.content}>
          <Box className={styles.logoContainer}>
            <img src={momCartImage} alt="Mom Cart" className={styles.logoImage} />
            <Typography variant="h4" className={styles.logoText}>
              Mom
            </Typography>
          </Box>
          
          <Box className={styles.textContent}>
            <Typography variant="h1" className={styles.headline}>
              All your recipes,
              <br />
              in one place
            </Typography>
            
            <Typography variant="body1" className={styles.description}>
              Mom is a recipe management platform that allows users to import recipes from other websites, note cards, and books so they can centralize their recipes.
            </Typography>
            
            <Box className={styles.buttonContainer}>
              <Button
                variant="contained"
                className={styles.signUpButton}
                onClick={handleSignUp}
              >
                Sign Up
              </Button>
              <Button
                variant="outlined"
                className={styles.loginButton}
                onClick={handleLogin}
              >
                Login
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box id="features" className={styles.featuresSection}>
        <Container maxWidth="lg" className={styles.featuresContainer}>
          <Typography variant="h2" className={styles.featuresTitle}>
            Centralize Your Recipe Collection
          </Typography>
          
          <Box className={styles.featuresGrid}>
            <Box className={styles.featureCard}>
              <Box className={styles.phoneImageContainer}>
                <img 
                  src={phoneImage} 
                  alt="Smartphone with recipe" 
                  className={styles.phoneImage}
                />
                <Box className={styles.phoneScreen}>
                  <img 
                    src={handwrittenRecipeImage} 
                    alt="Recipe on phone" 
                    className={styles.phoneScreenImage}
                  />
                </Box>
              </Box>
              <Typography variant="h3" className={styles.featureTitle}>
                Import from Anywhere
              </Typography>
              <Typography variant="body1" className={styles.featureDescription}>
                Bring your recipes together from websites, handwritten cards, cookbooks, and more. Everything in one convenient place.
              </Typography>
            </Box>
          </Box>

          <Box className={styles.additionalFeatures}>
            <Box className={styles.additionalFeature}>
              <Typography variant="h4" className={styles.additionalFeatureTitle}>
                Organize & Search
              </Typography>
              <Typography variant="body2" className={styles.additionalFeatureText}>
                Easily organize your recipes and find what you need with powerful search capabilities.
              </Typography>
            </Box>
            <Box className={styles.additionalFeature}>
              <Typography variant="h4" className={styles.additionalFeatureTitle}>
                Meal Planning
              </Typography>
              <Typography variant="body2" className={styles.additionalFeatureText}>
                Plan your meals and create shopping lists from your favorite recipes.
              </Typography>
            </Box>
            <Box className={styles.additionalFeature}>
              <Typography variant="h4" className={styles.additionalFeatureTitle}>
                Nutrition Tracking
              </Typography>
              <Typography variant="body2" className={styles.additionalFeatureText}>
                Track nutritional information and make informed choices about your meals.
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      <Box id="pricing" className={styles.pricingSection}>
        <Container maxWidth="lg" className={styles.pricingContainer}>
          <Typography variant="h2" className={styles.sectionTitle}>
            Pricing
          </Typography>
          <Box className={styles.pricingCard}>
            <Typography variant="h3" className={styles.pricingTitle}>
              Free
            </Typography>
            <Typography variant="h4" className={styles.pricingAmount}>
              $0
            </Typography>
            <Typography variant="body1" className={styles.pricingDescription}>
              Mom is completely free to use. Import, organize, and manage all your recipes without any cost or hidden fees.
            </Typography>
            <Box className={styles.pricingFeatures}>
              <Typography variant="body2" className={styles.pricingFeature}>
                Unlimited recipe storage
              </Typography>
              <Typography variant="body2" className={styles.pricingFeature}>
                AI-powered recipe import
              </Typography>
              <Typography variant="body2" className={styles.pricingFeature}>
                Meal planning tools
              </Typography>
              <Typography variant="body2" className={styles.pricingFeature}>
                Shopping list generation
              </Typography>
              <Typography variant="body2" className={styles.pricingFeature}>
                Nutrition tracking
              </Typography>
              <Typography variant="body2" className={styles.pricingFeature}>
                Access on all devices
              </Typography>
            </Box>
            <Button
              variant="contained"
              className={styles.pricingButton}
              onClick={handleSignUp}
            >
              Get Started Free
            </Button>
          </Box>
        </Container>
      </Box>

      <Box id="how-it-works" className={styles.howItWorksSection}>
        <Container maxWidth="lg" className={styles.howItWorksContainer}>
          <Typography variant="h2" className={styles.sectionTitle}>
            How It Works
          </Typography>
          <Box className={styles.stepsContainer}>
            <Box className={styles.step}>
              <Box className={styles.stepNumber}>1</Box>
              <Typography variant="h4" className={styles.stepTitle}>
                Upload Your Recipe
              </Typography>
              <Typography variant="body1" className={styles.stepDescription}>
                Take a photo of your handwritten recipe card, cookbook page, or import from any website URL.
              </Typography>
            </Box>
            <Box className={styles.step}>
              <Box className={styles.stepNumber}>2</Box>
              <Typography variant="h4" className={styles.stepTitle}>
                AI OCR Processing
              </Typography>
              <Typography variant="body1" className={styles.stepDescription}>
                Our advanced AI technology uses Optical Character Recognition (OCR) to automatically extract ingredients, instructions, and cooking details from your recipe images.
              </Typography>
            </Box>
            <Box className={styles.step}>
              <Box className={styles.stepNumber}>3</Box>
              <Typography variant="h4" className={styles.stepTitle}>
                Review & Organize
              </Typography>
              <Typography variant="body1" className={styles.stepDescription}>
                Review the automatically extracted recipe, make any adjustments, and add it to your organized recipe collection.
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      <Box className={styles.footer}>
        <Container maxWidth="lg" className={styles.footerContainer}>
          <Box className={styles.footerContent}>
            <Box className={styles.footerSection}>
              <Box className={styles.footerLogo}>
                <img src={momCartImage} alt="Mom Cart" className={styles.footerLogoImage} />
                <Typography variant="h6" className={styles.footerLogoText}>
                  Mom
                </Typography>
              </Box>
              <Typography variant="body2" className={styles.footerDescription}>
                Your recipe management platform for organizing and centralizing all your favorite recipes.
              </Typography>
            </Box>

            <Box className={styles.footerSection}>
              <Typography variant="h6" className={styles.footerSectionTitle}>
                Product
              </Typography>
              <Box className={styles.footerLinks}>
                <Typography 
                  variant="body2" 
                  className={styles.footerLink}
                  onClick={() => {
                    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Features
                </Typography>
                <Typography 
                  variant="body2" 
                  className={styles.footerLink}
                  onClick={() => {
                    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Pricing
                </Typography>
                <Typography 
                  variant="body2" 
                  className={styles.footerLink}
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  How It Works
                </Typography>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;

