import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, CircularProgress, Button } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

interface OrderHistoryItem {
  id: number;
  created_at: string;
  instacart_url: string | null;
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
  const { token } = useAuth();

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
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    {order.items_data.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(order.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {order.items_data.line_items.length} items
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  {order.items_data.line_items.slice(0, 3).map((item, index) => (
                    <Typography key={index} variant="body2">
                      {item.quantity} {item.unit} {item.name}
                    </Typography>
                  ))}
                  {order.items_data.line_items.length > 3 && (
                    <Typography variant="body2" color="text.secondary">
                      +{order.items_data.line_items.length - 3} more items
                    </Typography>
                  )}
                </Box>
                
                {order.instacart_url && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => window.open(order.instacart_url!, '_blank')}
                  >
                    View on Instacart
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}