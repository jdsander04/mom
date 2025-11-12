import React, { useEffect, useState } from 'react';
import { Typography, Card, CardContent, Box, CircularProgress, TextField, Button, List, ListItem, ListItemText, Divider } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Health.module.css';

const API_BASE = '/api/health';

type Allergy = { id: number; name: string; description?: string };
type Nutrient = { id: number; name: string; description?: string; value?: number };
type Budget = { weekly_budget: number; spent: number };

const Health: React.FC = () => {

  const [nutrients, setNutrients] = useState<Nutrient[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  const [totalCalories, setTotalCalories] = useState<number | null>(null);

  // local form state
  const [newNutrientName, setNewNutrientName] = useState('');
  const [newNutrientValue, setNewNutrientValue] = useState<string>('');
  const [weeklyBudgetInput, setWeeklyBudgetInput] = useState<string>('');

  const { token } = useAuth() as any;

  // Helper: convert camelCase / snake_case / kebab-case to Title Case with spaces
  function formatLabel(key: string) {
    if (!key) return '';
    // replace underscores or dashes with spaces
    let s = key.replace(/[_-]+/g, ' ');
    // insert space between lower-to-upper case transitions (camelCase)
    s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    // collapse multiple spaces
    s = s.replace(/\s+/g, ' ').trim();
    // Title case
    return s
      .split(' ')
      .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  }

  useEffect(() => {
    setLoading(true);
    fetch(API_BASE + '/', { headers: token ? { 'Authorization': `Bearer ${token}` } : undefined })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((json) => {
        setNutrients(json.nutrients || []);
        // backend may serialize Decimal fields as strings — coerce to numbers
        const normalizeBudget = (b: any) => ({
          weekly_budget: Number(b?.weekly_budget ?? 0) || 0,
          spent: Number(b?.spent ?? 0) || 0,
        });
        setBudget(normalizeBudget(json.budget));
        // Intentionally do NOT autofill the weekly budget input. The input
        // should remain blank so users must explicitly enter a new budget.
        // fetch aggregated nutrition totals
        fetch(API_BASE + '/nutrition-totals/', { headers: token ? { 'Authorization': `Bearer ${token}` } : undefined })
          .then((r) => r.ok ? r.json() : Promise.reject('Failed to load totals'))
          .then((tjson) => {
            setTotals(tjson.totals || null);
            setTotalCalories(typeof tjson.calories === 'number' ? tjson.calories : Number(tjson.calories ?? 0));
          })
          .catch(() => {
            // ignore totals errors for now
          });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);


  async function saveBudget() {
    const payload = { weekly_budget: parseFloat(weeklyBudgetInput || '0') };
  const res = await fetch(API_BASE + '/budget/', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
    if (!res.ok) { setError('Failed to save budget'); return; }
    const json = await res.json();
    // coerce decimals returned as strings into numbers
    setBudget({
      weekly_budget: Number(json.weekly_budget ?? 0) || 0,
      spent: Number(json.spent ?? 0) || 0,
    });
  }

  return (
    <Box>
      <h1 className={styles.pageTitle}>Health and Budgeting</h1>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Track your nutrients and budgets
      </Typography>

      {loading ? <CircularProgress /> : error ? <Typography color="error">{error}</Typography> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>


          <Card>
            <CardContent>
              <Typography variant="h6">Nutrients</Typography>
              <List>
                {nutrients.map(n => (
                  <ListItem key={n.id}><ListItemText primary={`${n.name} — ${n.value ?? ''}`} secondary={n.description} /></ListItem>
                ))}
              </List>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2">Aggregated totals</Typography>
              {totals ? (
                <List>
                  {Object.entries(totals).map(([k, v]) => (
                    <ListItem key={k}><ListItemText primary={`${formatLabel(k)}: ${Number(v).toFixed(3)}`} /></ListItem>
                  ))}
                  <ListItem><ListItemText primary={`${formatLabel('calories')}: ${totalCalories ?? 0}`} /></ListItem>
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">Totals not available</Typography>
              )}
              {/* Nutrient additions are disabled on this screen per request */}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6">Budget</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                {/* Circular progress showing percent of budget spent */}
                <Box sx={{ position: 'relative', display: 'inline-flex', width: 140, flex: '0 0 140px', justifyContent: 'center' }}>
                  {/**
                   * If weekly_budget is 0, show an empty grey circle and a note below.
                   */}
                  <CircularProgress
                    variant="determinate"
                    size={100}
                    thickness={6}
                    value={budget && budget.weekly_budget > 0 ? Math.min(100, (budget.spent / budget.weekly_budget) * 100) : 0}
                    sx={{
                      color: (theme) => {
                        if (!budget || budget.weekly_budget <= 0) return theme.palette.grey[300];
                        const pct = (budget.spent / budget.weekly_budget) * 100;
                        if (pct < 50) return theme.palette.success.main;
                        if (pct < 90) return theme.palette.warning.main;
                        return theme.palette.error.main;
                      }
                    }}
                  />
                  <Box sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h6">${budget ? Number(budget.spent).toFixed(2) : '0.00'}</Typography>
                      <Typography variant="caption" color="text.secondary">spent</Typography>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2">Weekly budget</Typography>
                  <Typography variant="h6">{budget && budget.weekly_budget > 0 ? `$${Number(budget.weekly_budget).toFixed(2)}` : 'Not set'}</Typography>
                  {budget && budget.weekly_budget > 0 && (
                    <Typography variant="caption" color="text.secondary">{Math.min(100, ((budget.spent / budget.weekly_budget) * 100)).toFixed(0)}% used</Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <TextField label="Set weekly budget" value={weeklyBudgetInput} onChange={(e) => setWeeklyBudgetInput(e.target.value)} size="small" placeholder="e.g. 50" />
                    <Button variant="contained" onClick={saveBudget}>Save</Button>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default Health;