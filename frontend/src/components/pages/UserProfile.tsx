import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

type LocalItem = { id: string; value: string; serverId?: number };

const API_BASE = 'http://localhost:8000/api';

function serverToLocalPref(p: any): LocalItem {
  return { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), value: p.name ?? '', serverId: p.id };
}

async function fetchJSON(url: string, token?: string, opts: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function searchLocalDB(db: string[], q: string, limit = 6) {
  const s = q.trim().toLowerCase();
  if (!s) return db.slice(0, limit);
  return db.filter((d) => d.toLowerCase().includes(s)).slice(0, limit);
}

export default function UserProfile() {
  const { token: authToken, avatarUrl, refreshAvatar } = useAuth() as any;
  const token = authToken ?? null;

  const [dietPlans, setDietPlans] = useState<LocalItem[]>([{ id: 'd1', value: '' }]);
  const [allergens, setAllergens] = useState<LocalItem[]>([{ id: 'a1', value: '' }]);
  const [focusedDietId, setFocusedDietId] = useState<string | null>(null);
  const [focusedAllergenId, setFocusedAllergenId] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const DIET_DB = useMemo(() => [], []);
  const INGREDIENT_DB = useMemo(() => [], []);

  const [userName, setUserName] = useState<string>('');
  const [profilePic, setProfilePic] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchJSON(`${API_BASE}/user/me/`, token)
      .then((data) => {
        setUserName(data.name || data.username || 'Name');
        setProfilePic(data.profile_pic || null);
      })
      .catch((e) => {
        console.error('Failed to fetch user profile', e);
      });
  }, [token]);

  // item statuses and errors
  const [itemStatus, setItemStatus] = useState<Record<string, 'idle' | 'saving' | 'deleting' | 'error'>>({});
  const [itemError, setItemError] = useState<Record<string, string>>({});
  const [saveAllStatus, setSaveAllStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveAllError, setSaveAllError] = useState<string | null>(null);

  const setStatus = (id: string, status: 'idle' | 'saving' | 'deleting' | 'error') =>
    setItemStatus((s) => ({ ...s, [id]: status }));

  const setError = (id: string, msg: string | null) =>
    setItemError((e) => {
      const copy = { ...e };
      if (msg) copy[id] = msg;
      else delete copy[id];
      return copy;
    });

  function addItem(setter: React.Dispatch<React.SetStateAction<LocalItem[]>>) {
    return () => setter((prev) => [...prev, { id: Date.now().toString(), value: '' }]);
  }

  function updateItem(setter: React.Dispatch<React.SetStateAction<LocalItem[]>>) {
    return (id: string, value: string) => setter((prev) => prev.map((x) => (x.id === id ? { ...x, value } : x)));
  }

  function removeItem(setter: React.Dispatch<React.SetStateAction<LocalItem[]>>) {
    return (id: string) => setter((prev) => prev.filter((x) => x.id !== id));
  }

  const addDietPlan = addItem(setDietPlans);
  const addAllergen = addItem(setAllergens);
  const updateDiet = updateItem(setDietPlans);
  const updateAllergen = updateItem(setAllergens);
  const removeDiet = removeItem(setDietPlans);
  const removeAllergen = removeItem(setAllergens);

  const selectSuggestion = (setter: React.Dispatch<React.SetStateAction<LocalItem[]>>) => (id: string, suggestion: string) =>
    setter((prev) => prev.map((it) => (it.id === id ? { ...it, value: suggestion } : it)));

  const selectDietSuggestion = selectSuggestion(setDietPlans);
  const selectIngredientSuggestion = selectSuggestion(setAllergens);

  // remote search hook
  function useRemoteSearch(type: 'diet' | 'ingredient', q: string, token: string | null, localDb: string[]) {
    const [results, setResults] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const controllerRef = useRef<AbortController | null>(null);
    const lastRef = useRef(q);

    useEffect(() => {
      lastRef.current = q;
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      if (!token) {
        setResults(searchLocalDB(localDb, q, 6));
        setLoading(false);
        return;
      }
      if (!q || q.trim().length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      const id = setTimeout(() => {
        const c = new AbortController();
        controllerRef.current = c;
        setLoading(true);
        const endpoint =
          type === 'diet'
            ? `${API_BASE}/diet_suggestions/?q=${encodeURIComponent(q)}`
            : `${API_BASE}/ingredient_suggestions/?q=${encodeURIComponent(q)}`;

        fetchJSON(endpoint, token, { signal: c.signal })
          .then((json) => {
            let list: string[] = [];
            if (Array.isArray(json.suggestions)) {
              list = json.suggestions.filter((s: any) => typeof s === 'string');
            } else if (Array.isArray(json.results)) {
              list = json.results.map((r: any) => (typeof r === 'string' ? r : r?.name ?? String(r))).filter(Boolean);
            } else if (Array.isArray(json)) {
              list = json.map((r: any) => (typeof r === 'string' ? r : r?.name ?? String(r))).filter(Boolean);
            }
            if (lastRef.current === q) setResults(list);
          })
          .catch((err) => {
            if ((err as any).name === 'AbortError') return;
            console.error('remote search error', err);
            setResults(searchLocalDB(localDb, q, 6));
          })
          .finally(() => {
            if (lastRef.current === q) setLoading(false);
          });
      }, 220);

      return () => {
        clearTimeout(id);
        if (controllerRef.current) {
          controllerRef.current.abort();
          controllerRef.current = null;
        }
      };
    }, [type, q, token, localDb]);

    return { results, loading };
  }

  // server sync helpers
  async function fetchPrefsAndRestrictions(tok: string) {
    try {
      const prefs = await fetchJSON(`${API_BASE}/diet/pref`, tok);
      if (prefs && Array.isArray(prefs.preferences)) {
        setDietPlans(prefs.preferences.map((p: any) => serverToLocalPref(p)));
      }
      const rests = await fetchJSON(`${API_BASE}/diet-rest`, tok);
      if (rests && Array.isArray(rests.restrictions)) {
        setAllergens(rests.restrictions.map((r: any) => serverToLocalPref(r)));
      }
    } catch (e) {
      console.error('fetchPrefsAndRestrictions error', e);
    }
  }

  async function retry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 500): Promise<T> {
    let lastErr: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        const backoff = delayMs * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
    throw lastErr;
  }

  async function createPrefOnServer(localId: string, name: string, tok: string) {
    try {
      const json = await retry(() =>
        fetchJSON(`${API_BASE}/diet/pref`, tok, {
          method: 'POST',
          body: JSON.stringify({ name }),
        })
      );
      if (json && (json.id || json.name)) {
        setDietPlans((prev) => prev.map((it) => (it.id === localId ? { ...it, serverId: json.id ?? it.serverId, value: json.name ?? name } : it)));
      }
    } catch (e) {
      console.error('createPrefOnServer error', e);
      throw e;
    }
  }

  async function deletePrefOnServer(serverId?: number | null) {
    if (!serverId) return;
    try {
      await retry(() => fetchJSON(`${API_BASE}/diet/pref/${serverId}/`, token ?? undefined, { method: 'DELETE' }));
    } catch (e) {
      console.error('deletePrefOnServer error', e);
      throw e;
    }
  }

  async function createRestrictionOnServer(localId: string, name: string, tok: string) {
    try {
      const json = await retry(() => fetchJSON(`${API_BASE}/diet-rest`, tok, { method: 'POST', body: JSON.stringify({ name }) }));
      if (json && (json.id || json.name)) {
        setAllergens((prev) => prev.map((it) => (it.id === localId ? { ...it, serverId: json.id ?? it.serverId, value: json.name ?? name } : it)));
      }
    } catch (e) {
      console.error('createRestrictionOnServer error', e);
      throw e;
    }
  }

  async function deleteRestrictionOnServer(serverId?: number | null) {
    if (!serverId) return;
    try {
      await retry(() => fetchJSON(`${API_BASE}/diet-rest/${serverId}/`, token ?? undefined, { method: 'DELETE' }));
    } catch (e) {
      console.error('deleteRestrictionOnServer error', e);
      throw e;
    }
  }

  useEffect(() => {
    if (token) {
      fetchPrefsAndRestrictions(token).catch((e) => console.error('pref fetch error', e));
    }
  }, [token]);

  useEffect(() => {
    let revoke: string | null = null;
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      revoke = url;
    } else {
      setPreviewUrl(null);
    }
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [selectedFile]);


  async function handleUpload() {
    if (!selectedFile) return;
    try {
      setUploading(true);
      await apiService.uploadProfileImage(selectedFile);
      await refreshAvatar().catch(() => {});
      setSelectedFile(null);
      // Refresh page to show updated avatar
      window.location.reload();
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      setSelectedFile(file);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  // derive focused queries
  const currentDietQuery = focusedDietId ? dietPlans.find((p) => p.id === focusedDietId)?.value ?? '' : '';
  const currentIngredientQuery = focusedAllergenId ? allergens.find((a) => a.id === focusedAllergenId)?.value ?? '' : '';

  const dietSearch = useRemoteSearch('diet', currentDietQuery, token, DIET_DB);
  const ingredientSearch = useRemoteSearch('ingredient', currentIngredientQuery, token, INGREDIENT_DB);

  async function handleSaveAll() {
    if (!token) return;
    const toSaveDiet = dietPlans.filter((d) => !d.serverId && d.value && d.value.trim().length > 0);
    const toSaveAllergen = allergens.filter((a) => !a.serverId && a.value && a.value.trim().length > 0);

    // Only proceed if there are changes to save
    if (toSaveDiet.length === 0 && toSaveAllergen.length === 0) {
      return;
    }

    setSaveAllStatus('saving');
    setSaveAllError(null);

    let anyError = false;
    for (const d of toSaveDiet) {
      setStatus(d.id, 'saving');
      try {
        await createPrefOnServer(d.id, d.value.trim(), token);
        setStatus(d.id, 'idle');
        setError(d.id, null);
      } catch (e: any) {
        setStatus(d.id, 'error');
        setError(d.id, e?.message ?? 'Save failed');
        anyError = true;
      }
    }

    for (const a of toSaveAllergen) {
      setStatus(a.id, 'saving');
      try {
        await createRestrictionOnServer(a.id, a.value.trim(), token);
        setStatus(a.id, 'idle');
        setError(a.id, null);
      } catch (e: any) {
        setStatus(a.id, 'error');
        setError(a.id, e?.message ?? 'Save failed');
        anyError = true;
      }
    }

    if (anyError) {
      setSaveAllStatus('error');
      setSaveAllError('Some items failed to save — check item errors');
    } else {
      setSaveAllStatus('success');
      // Refresh page only if changes were successfully saved
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }

  async function handleDeleteDiet(localId: string) {
    const it = dietPlans.find((d) => d.id === localId);
    if (!it) return;
    if (it.serverId && token) {
      setStatus(localId, 'deleting');
      try {
        await deletePrefOnServer(it.serverId);
      } catch (e) {
        setStatus(localId, 'error');
        console.error(e);
      }
    }
    removeDiet(localId);
    setStatus(localId, 'idle');
    setError(localId, null);
    setSaveAllStatus('idle');
    setSaveAllError(null);
  }

  async function handleDeleteAllergen(localId: string) {
    const it = allergens.find((d) => d.id === localId);
    if (!it) return;
    if (it.serverId && token) {
      setStatus(localId, 'deleting');
      try {
        await deleteRestrictionOnServer(it.serverId);
      } catch (e) {
        setStatus(localId, 'error');
        console.error(e);
      }
    }
    removeAllergen(localId);
    setStatus(localId, 'idle');
    setError(localId, null);
    setSaveAllStatus('idle');
    setSaveAllError(null);
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 4 }}>
      <Card sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ position: 'relative', display: 'inline-block', '&:hover .hoverOverlay': { opacity: 1 } }}>
            <Button
              onClick={openFilePicker}
              disabled={!token}
              sx={{
                minWidth: 0,
                p: 0,
                borderRadius: '50%',
                lineHeight: 0,
              }}
            >
              <Avatar sx={{ width: 64, height: 64 }} src={previewUrl || profilePic || avatarUrl || undefined}>
                {userName ? userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : 'JD'}
              </Avatar>
            </Button>
            <Box className="hoverOverlay" sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: '50%',
              bgcolor: 'rgba(0,0,0,0.45)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              transition: 'opacity 0.2s ease',
              pointerEvents: 'none'
            }}>
              <Typography variant="caption">Change</Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{userName}</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage your dietary plans and allergens
            </Typography>
          </Box>
          <Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFilePick}
            />
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={!token || !selectedFile || uploading}
                startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : undefined}
              >
                {uploading ? 'Saving…' : 'Save changes'}
              </Button>
            </Stack>
          </Box>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Dietary plan section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Dietary plan
          </Typography>
          <Card variant="outlined" sx={{ p: 2 }}>
            {dietPlans.map((plan) => (
              <Box key={plan.id} sx={{ mb: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    fullWidth
                    value={plan.value}
                    placeholder="Search diets"
                    onChange={(e) => updateDiet(plan.id, e.target.value)}
                    onFocus={() => setFocusedDietId(plan.id)}
                    onBlur={() => setTimeout(() => setFocusedDietId((id) => (id === plan.id ? null : id)), 150)}
                    size="small"
                  />
                  {itemStatus[plan.id] === 'error' ? (
                    <IconButton onClick={() => {/* no-op: show retry below */}} color="error">
                      <RefreshIcon />
                    </IconButton>
                  ) : null}
                  <IconButton onClick={() => handleDeleteDiet(plan.id)}>
                    {itemStatus[plan.id] === 'deleting' ? <CircularProgress size={20} /> : <DeleteOutlineIcon />}
                  </IconButton>
                </Stack>
                {itemStatus[plan.id] === 'error' && itemError[plan.id] ? (
                  <Typography color="error" variant="body2" sx={{ mt: 0.5 }}>
                    {itemError[plan.id]}
                  </Typography>
                ) : null}

                {focusedDietId === plan.id && (
                  <Paper elevation={3} sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                    <List dense>
                      {(dietSearch.results.length > 0 ? dietSearch.results : searchLocalDB(DIET_DB, currentDietQuery, 6)).map((s) => (
                        <ListItem key={s} disablePadding>
                          <ListItemButton onMouseDown={() => selectDietSuggestion(plan.id, s)}>
                            <ListItemText primary={s} />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                    {dietSearch.loading ? (
                      <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress size={20} />
                      </Box>
                    ) : null}
                  </Paper>
                )}
              </Box>
            ))}

            <Box sx={{ mt: 1 }}>
              <Button startIcon={<AddIcon />} onClick={addDietPlan}>
                Add diet plan
              </Button>
            </Box>
          </Card>
        </Box>

        {/* Allergens section */}
        <Box>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Allergens
          </Typography>
          <Card variant="outlined" sx={{ p: 2 }}>
            {allergens.map((all) => (
              <Box key={all.id} sx={{ mb: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    fullWidth
                    value={all.value}
                    placeholder="Search ingredients"
                    onChange={(e) => updateAllergen(all.id, e.target.value)}
                    onFocus={() => setFocusedAllergenId(all.id)}
                    onBlur={() => setTimeout(() => setFocusedAllergenId((id) => (id === all.id ? null : id)), 150)}
                    size="small"
                  />
                  {itemStatus[all.id] === 'error' ? (
                    <IconButton onClick={() => {/* show retry action below */}} color="error">
                      <RefreshIcon />
                    </IconButton>
                  ) : null}
                  <IconButton onClick={() => handleDeleteAllergen(all.id)}>
                    {itemStatus[all.id] === 'deleting' ? <CircularProgress size={20} /> : <DeleteOutlineIcon />}
                  </IconButton>
                </Stack>
                {itemStatus[all.id] === 'error' && itemError[all.id] ? (
                  <Typography color="error" variant="body2" sx={{ mt: 0.5 }}>
                    {itemError[all.id]}
                  </Typography>
                ) : null}

                {focusedAllergenId === all.id && (
                  <Paper elevation={3} sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                    <List dense>
                      {(ingredientSearch.results.length > 0 ? ingredientSearch.results : searchLocalDB(INGREDIENT_DB, currentIngredientQuery, 6)).map((s) => (
                        <ListItem key={s} disablePadding>
                          <ListItemButton onMouseDown={() => selectIngredientSuggestion(all.id, s)}>
                            <ListItemText primary={s} />
                          </ListItemButton>
                        </ListItem>
                      ))}
                    </List>
                    {ingredientSearch.loading ? (
                      <Box sx={{ p: 1, display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress size={20} />
                      </Box>
                    ) : null}
                  </Paper>
                )}
              </Box>
            ))}

            <Box sx={{ mt: 1 }}>
              <Button startIcon={<AddIcon />} onClick={addAllergen}>
                Add allergen
              </Button>
            </Box>
          </Card>
        </Box>
      </Card>
    </Box>
  );
}
