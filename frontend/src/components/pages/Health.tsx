import React, { useEffect, useState } from 'react';
import { Typography, Card, CardContent, Box, CircularProgress, TextField, Button, List, ListItem, ListItemText } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Health.module.css';

const API_BASE = '/api/health';

type Allergy = { id: number; name: string; description?: string };
type Nutrient = { id: number; name: string; description?: string; value?: number };
type Budget = { weekly_budget: number; spent: number };

const Health: React.FC = () => {
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [nutrients, setNutrients] = useState<Nutrient[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // local form state
  const [newAllergyName, setNewAllergyName] = useState('');
  const [newNutrientName, setNewNutrientName] = useState('');
  const [newNutrientValue, setNewNutrientValue] = useState<string>('');
  const [weeklyBudgetInput, setWeeklyBudgetInput] = useState<string>('');

  const { token } = useAuth() as any;

  useEffect(() => {
    setLoading(true);
    fetch(API_BASE + '/', { headers: token ? { 'Authorization': `Bearer ${token}` } : undefined })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((json) => {
        setAllergies(json.allergies || []);
        setNutrients(json.nutrients || []);
        setBudget(json.budget || { weekly_budget: 0, spent: 0 });
        setWeeklyBudgetInput(String((json.budget && json.budget.weekly_budget) || 0));
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function addAllergy() {
    if (!newAllergyName.trim()) return;
    const res = await fetch(API_BASE + '/allergies/', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ name: newAllergyName }) });
    if (!res.ok) { setError('Failed to add allergy'); return; }
    const json = await res.json();
    setAllergies((s) => [json, ...s]);
    setNewAllergyName('');
  }

  async function addNutrient() {
    if (!newNutrientName.trim()) return;
    const body: any = { name: newNutrientName };
    if (newNutrientValue.trim()) body.value = parseFloat(newNutrientValue);
  const res = await fetch(API_BASE + '/nutrients/', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    if (!res.ok) { setError('Failed to add nutrient'); return; }
    const json = await res.json();
    setNutrients((s) => [json, ...s]);
    setNewNutrientName('');
    setNewNutrientValue('');
  }

  async function saveBudget() {
    const payload = { weekly_budget: parseFloat(weeklyBudgetInput || '0') };
  const res = await fetch(API_BASE + '/budget/', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) });
    if (!res.ok) { setError('Failed to save budget'); return; }
    const json = await res.json();
    setBudget(json);
  }

  return (
    <Box>
      <h1 className={styles.pageTitle}>Health and Budgeting</h1>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        Track your health, allergies, nutrients and budgets
      </Typography>

      {loading ? <CircularProgress /> : error ? <Typography color="error">{error}</Typography> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <Card>
            <CardContent>
              <Typography variant="h6">Allergies</Typography>
              <List>
                {allergies.map(a => (
                  <ListItem key={a.id}><ListItemText primary={a.name} secondary={a.description} /></ListItem>
                ))}
              </List>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <TextField value={newAllergyName} onChange={(e) => setNewAllergyName(e.target.value)} size="small" placeholder="New allergy" />
                <Button variant="contained" onClick={addAllergy}>Add</Button>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6">Nutrients</Typography>
              <List>
                {nutrients.map(n => (
                  <ListItem key={n.id}><ListItemText primary={`${n.name} — ${n.value ?? ''}`} secondary={n.description} /></ListItem>
                ))}
              </List>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <TextField value={newNutrientName} onChange={(e) => setNewNutrientName(e.target.value)} size="small" placeholder="Nutrient name" />
                <TextField value={newNutrientValue} onChange={(e) => setNewNutrientValue(e.target.value)} size="small" placeholder="value" />
                <Button variant="contained" onClick={addNutrient}>Add</Button>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6">Budget</Typography>
              <Typography>Spent: ${budget?.spent?.toFixed(2) ?? '0.00'}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <TextField label="Weekly budget" value={weeklyBudgetInput} onChange={(e) => setWeeklyBudgetInput(e.target.value)} size="small" />
                <Button variant="contained" onClick={saveBudget}>Save</Button>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default Health;