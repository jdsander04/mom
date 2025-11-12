import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, CircularProgress, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

interface OrderHistoryItem {
  id: number;
  created_at: string;
  instacart_url: string | null;
  recipe_names: string[];
  top_recipe_image: string | null;
  nutrition_data: Record<string, number>;
  total_price: number | null;
  items_data: {
    title: string;
    line_items: Array<{
      name: string;
      quantity: number;
      unit: string;
    }>;
  };
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderHistoryItem | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const { token } = useAuth();

  const reorderCart = async (orderId: number) => {
    try {
      const response = await fetch(`/api/cart/reorder/${orderId}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        alert('Order re-added to cart!');
      } else {
        alert('Failed to re-order');
      }
    } catch (error) {
      console.error('Failed to reorder:', error);
    }
  };

  const openPriceDialog = (order: OrderHistoryItem) => {
    setSelectedOrder(order);
    setPriceInput(order.total_price?.toString() || '');
    setPriceDialogOpen(true);
  };

  const savePrice = async () => {
    if (!selectedOrder || !priceInput) return;
    
    try {
      const response = await fetch(`/api/cart/order-history/${selectedOrder.id}/set-price/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ price: parseFloat(priceInput) })
      });
      
      if (response.ok) {
        setOrders(orders.map(order => 
          order.id === selectedOrder.id 
            ? { ...order, total_price: parseFloat(priceInput) }
            : order
        ));
        setPriceDialogOpen(false);
      }
    } catch (error) {
      console.error('Failed to save price:', error);
    }
  };

  const deleteOrder = async (orderId: number) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    
    try {
      const response = await fetch(`/api/cart/order-history/${orderId}/delete/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        setOrders(orders.filter(order => order.id !== orderId));
      }
    } catch (error) {
      console.error('Failed to delete order:', error);
    }
  };

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/cart/order-history/', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const orders = await response.json();
        setOrders(orders);
      } catch (error) {
        console.error('Failed to fetch order history:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchOrders();
    }
  }, [token]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Order History
      </Typography>
      
      {orders.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">
              No orders found. Start shopping to see your order history!
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {orders.map((order) => (
            <Card key={order.id}>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {order.top_recipe_image && (
                    <Box sx={{ width: 80, height: 80, flexShrink: 0 }}>
                      <img 
                        src={order.top_recipe_image} 
                        alt="Recipe" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                      />
                    </Box>
                  )}
                  
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h6">
                        {order.items_data?.title || 'Shopping List'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(order.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {order.recipe_names?.length || 0} recipes • {order.items_data?.line_items?.length || 0} items
                      {order.total_price && ` • $${order.total_price}`}
                    </Typography>
                    
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>Recipes:</Typography>
                      {order.recipe_names?.slice(0, 3).map((recipeName, index) => (
                        <Typography key={index} variant="body2" sx={{ ml: 1 }}>
                          • {recipeName}
                        </Typography>
                      )) || []}
                      {(order.recipe_names?.length || 0) > 3 && (
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                          +{(order.recipe_names?.length || 0) - 3} more recipes
                        </Typography>
                      )}
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => reorderCart(order.id)}
                      >
                        Re-order
                      </Button>
                      
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => openPriceDialog(order)}
                      >
                        {order.total_price ? 'Edit Price' : 'Set Price'}
                      </Button>
                      
                      {order.instacart_url && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => window.open(order.instacart_url!, '_blank')}
                        >
                          View on Instacart
                        </Button>
                      )}
                      
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        onClick={() => deleteOrder(order.id)}
                      >
                        Delete
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
    
    <Dialog open={priceDialogOpen} onClose={() => setPriceDialogOpen(false)}>
      <DialogTitle>Set Order Price</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Price ($)"
          type="number"
          fullWidth
          variant="outlined"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPriceDialogOpen(false)}>Cancel</Button>
        <Button onClick={savePrice} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
    </>
  );
}