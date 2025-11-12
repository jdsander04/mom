import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, CircularProgress } from '@mui/material';
import { apiService } from '../../services/api';

interface InstacartPricePopupProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (amount: number) => void;
}

export default function InstacartPricePopup({ open, onClose, onSaved }: InstacartPricePopupProps) {
  const [value, setValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    const parsed = parseFloat(value.replace(/[^0-9.-]/g, ''));
    if (Number.isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid non-negative amount.');
      return;
    }

    setLoading(true);
    try {
      // Use the existing health budget endpoint to store spent amount. The
      // backend `BudgetRetrieveUpdateView` accepts POST to `/api/health/budget/`
      // and will create/update the per-user Budget record. We send the new
      // `spent` value here. If you prefer the server to increment rather than
      // set a value, change the server-side handler accordingly.
  // POST to the new incremental endpoint which will add the amount to the
  // user's current `spent` total instead of overwriting it.
  await apiService.post('/health/budget/spent/', { amount: parsed });
      // apiService.post returns { data: ... } per helper implementation
      if (onSaved) onSaved(parsed);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save amount');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError(null);
      setValue('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Enter total Instacart cost</DialogTitle>
      <DialogContent>
        <div style={{ marginTop: 8 }}>
          <TextField
            label="Total cost (USD)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            fullWidth
            autoFocus
            placeholder="e.g. 42.50"
            InputProps={{ inputMode: 'decimal' }}
            helperText={error || 'Enter the total amount you paid to Instacart.'}
            error={!!error}
            disabled={loading}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? <CircularProgress size={20} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
