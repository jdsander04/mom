import { Card, CardContent, CardMedia, Typography, IconButton, Box } from '@mui/material';
import { OpenInNew, Restaurant } from '@mui/icons-material';

interface RecipeCardProps {
  title: string;
  subtitle?: string;
  image: string;
  calories: number;
  servings: number;
  onClick: () => void;
}

const CARD_STYLES = {
  position: 'relative',
  backgroundColor: 'white',
  border: '1px solid #e0e0e0',
  borderRadius: '14px',
  padding: '12px',
  display: 'flex',
  alignItems: 'center',
  cursor: 'pointer',
  boxShadow: 'none',
  '&:hover': {
    boxShadow: 1
  }
};

const IMAGE_STYLES = {
  width: 96,
  height: 96,
  borderRadius: '8px',
  objectFit: 'cover',
  marginRight: '16px'
};

const CONTENT_STYLES = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: 0,
  '&:last-child': { paddingBottom: 0 }
};

const TITLE_STYLES = {
  fontSize: '16px',
  fontWeight: 600,
  color: 'black',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const SUBTITLE_STYLES = {
  fontSize: '14px',
  fontWeight: 400,
  color: '#555',
  marginLeft: '4px'
};

const METADATA_STYLES = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '13px',
  color: '#666',
  whiteSpace: 'nowrap'
};

const ICON_BUTTON_STYLES = {
  position: 'absolute',
  top: '8px',
  right: '8px',
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: '#666',
  padding: '4px',
  '&:hover': {
    color: '#333',
    backgroundColor: 'transparent'
  }
};

const RecipeCard = ({ title, subtitle, image, calories, servings, onClick }: RecipeCardProps) => {
  return (
    <Card sx={CARD_STYLES}>
      {image ? (
        <CardMedia
          component="img"
          sx={IMAGE_STYLES}
          image={image}
          alt={title}
        />
      ) : (
        <Box
          sx={{
            ...IMAGE_STYLES,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            color: '#999'
          }}
        >
          <Restaurant sx={{ fontSize: '32px' }} />
        </Box>
      )}
      <CardContent sx={CONTENT_STYLES}>
        <Box sx={{ marginBottom: '8px' }}>
          <Typography variant="body1" component="span" sx={TITLE_STYLES}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" component="span" sx={SUBTITLE_STYLES}>
              ({subtitle})
            </Typography>
          )}
        </Box>
        <Box sx={METADATA_STYLES}>
          <Typography variant="body2" sx={{ fontSize: '13px', color: '#666' }}>
            {calories > 0 ? `${calories} kcal` : 'Calories N/A'}
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '13px', color: '#666' }}>
            Serves {servings}
          </Typography>
        </Box>
      </CardContent>
      <IconButton onClick={onClick} sx={ICON_BUTTON_STYLES} size="small">
        <OpenInNew sx={{ fontSize: '16px' }} />
      </IconButton>
    </Card>
  );
};

export default RecipeCard;
