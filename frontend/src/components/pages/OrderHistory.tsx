import { useState, useEffect } from 'react';
import { Box, CircularProgress, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { ViewList as ViewListIcon, ViewModule as ViewModuleIcon } from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import styles from './OrderHistory.module.css';

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

type ViewMode = 'card' | 'list';

export default function OrderHistory() {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderHistoryItem | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('card');
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

  const getOrderName = (order: OrderHistoryItem) => {
    if (order.recipe_names && order.recipe_names.length > 0) {
      return order.recipe_names[0];
    }
    return order.items_data?.title || 'Shopping List';
  };

  const getRecipeCountText = (count: number) => {
    return count === 1 ? '1 recipe' : `${count} recipes`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <div className={styles.container}>
        <Box
          className={styles.headerRow}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px'
          }}
        >
          <h1 className={styles.pageTitle}>Order History</h1>
          <Button
            variant="outlined"
            startIcon={viewMode === 'list' ? <ViewModuleIcon /> : <ViewListIcon />}
            onClick={() => setViewMode(prev => prev === 'list' ? 'card' : 'list')}
            sx={{
              borderColor: '#e0e0e0',
              color: '#666',
              backgroundColor: 'transparent',
              '&:hover': {
                borderColor: '#bdbdbd',
                backgroundColor: '#f5f5f5'
              },
              borderRadius: 2,
              padding: '8px 16px',
              textTransform: 'none',
              fontSize: '0.875rem'
            }}
          >
            {viewMode === 'list' ? 'Card view' : 'List view'}
          </Button>
        </Box>

        {orders.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyStateText}>
              No orders found. Start shopping to see your order history!
            </p>
          </div>
        ) : (
          <div className={styles.ordersList}>
            {orders.map((order) => (
              <OrderHistoryCard
                key={order.id}
                order={order}
                viewMode={viewMode}
                getOrderName={getOrderName}
                getRecipeCountText={getRecipeCountText}
                formatDate={formatDate}
                onReorder={reorderCart}
                onOpenPriceDialog={openPriceDialog}
                onDelete={deleteOrder}
              />
            ))}
          </div>
        )}
      </div>

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

interface OrderHistoryCardProps {
  order: OrderHistoryItem;
  viewMode: ViewMode;
  getOrderName: (order: OrderHistoryItem) => string;
  getRecipeCountText: (count: number) => string;
  formatDate: (dateString: string) => string;
  onReorder: (orderId: number) => void;
  onOpenPriceDialog: (order: OrderHistoryItem) => void;
  onDelete: (orderId: number) => void;
}

function OrderHistoryCard({
  order,
  viewMode,
  getOrderName,
  getRecipeCountText,
  formatDate,
  onReorder,
  onOpenPriceDialog,
  onDelete
}: OrderHistoryCardProps) {
  const baseClassName = `${styles.orderCard} ${viewMode === 'list' ? styles.orderCardList : styles.orderCardCard
    }`;

  if (viewMode === 'list') {
    return (
      <div className={baseClassName}>
        <div className={styles.listContent}>
          <div className={styles.listText}>
            <h2 className={styles.orderName}>{getOrderName(order)}</h2>
            <p className={styles.recipeCount}>
              {getRecipeCountText(order.recipe_names?.length || 0)}
            </p>
          </div>
          <div className={styles.listRight}>
            <p className={styles.orderDate}>{formatDate(order.created_at)}</p>
            {order.total_price !== null && order.total_price !== undefined && (
              <p className={styles.orderPrice}>${Number(order.total_price).toFixed(2)}</p>
            )}
            <div className={styles.actionsContainer}>
              <button
                className={styles.reorderButton}
                onClick={() => onReorder(order.id)}
              >
                RE-ORDER
              </button>

              <button
                className={styles.setPriceButton}
                onClick={() => onOpenPriceDialog(order)}
              >
                SET PRICE
              </button>

              {order.instacart_url && (
                <button
                  className={styles.viewInstacartButton}
                  onClick={() => window.open(order.instacart_url!, '_blank')}
                >
                  VIEW ON INSTACART
                </button>
              )}

              <button
                className={styles.deleteButton}
                onClick={() => onDelete(order.id)}
              >
                DELETE
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Card view (existing rich layout)
  return (
    <div className={baseClassName}>
      <div className={styles.cardContent}>
        {order.top_recipe_image && (
          <img
            src={order.top_recipe_image}
            alt="Recipe"
            className={styles.orderImage}
          />
        )}

        <div className={styles.orderDetails}>
          <div className={styles.orderHeader}>
            <h2 className={styles.orderName}>{getOrderName(order)}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
              <p className={styles.orderDate}>{formatDate(order.created_at)}</p>
              {order.total_price !== null && order.total_price !== undefined && (
                <p className={styles.orderPrice}>${Number(order.total_price).toFixed(2)}</p>
              )}
            </div>
          </div>

          <p className={styles.recipeCount}>
            {getRecipeCountText(order.recipe_names?.length || 0)}
          </p>

          {order.recipe_names && order.recipe_names.length > 0 && (
            <div>
              <p className={styles.recipesListTitle}>Recipes:</p>
              <ul className={styles.recipesList}>
                {order.recipe_names.map((recipeName, index) => (
                  <li key={index} className={styles.recipeItem}>
                    • {recipeName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.actionsContainer}>
            <button
              className={styles.reorderButton}
              onClick={() => onReorder(order.id)}
            >
              RE-ORDER
            </button>

            <button
              className={styles.setPriceButton}
              onClick={() => onOpenPriceDialog(order)}
            >
              SET PRICE
            </button>

            {order.instacart_url && (
              <button
                className={styles.viewInstacartButton}
                onClick={() => window.open(order.instacart_url!, '_blank')}
              >
                VIEW ON INSTACART
              </button>
            )}

            <button
              className={styles.deleteButton}
              onClick={() => onDelete(order.id)}
            >
              DELETE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
