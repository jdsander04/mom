import { useState, useEffect } from 'react'
import { ExpandMore, CheckCircle, AddCircleOutline, Delete, MoreVert } from '@mui/icons-material'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, Menu, MenuItem } from '@mui/material'
import { useAuth } from '../../../contexts/AuthContext'
import { useCartContext } from '../../../contexts/CartContext'
import styles from './RecipeAccordion.module.css'

interface RecipeAccordionProps {
  recipeId: number
  title: string
  calories: number
  serves: number
  children: React.ReactNode
  sourceUrl?: string
  onRecipeDeleted?: () => void
  favorite?: boolean
  onRecipeUpdated?: () => void
}

const RecipeAccordion = ({ recipeId, title, calories, serves, children, sourceUrl, onRecipeDeleted, favorite = false, onRecipeUpdated }: RecipeAccordionProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const [currentQuantity, setCurrentQuantity] = useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [isFavorite, setIsFavorite] = useState<boolean>(favorite)
  const { token } = useAuth()
  const { cart, refreshCart } = useCartContext()

  useEffect(() => {
    checkRecipeInCart()
  }, [recipeId, cart])

  useEffect(() => {
    setIsFavorite(favorite)
  }, [favorite, recipeId])

  const checkRecipeInCart = async () => {
    const entry = cart?.recipes?.find(r => r.recipe_id === recipeId)
    if (entry) {
      setIsAdded(true)
      const qty = entry.serving_size || 1
      // Clamp to 1..3 for UI
      setCurrentQuantity(Math.min(3, Math.max(1, Math.round(qty))))
    } else {
      setIsAdded(false)
      setCurrentQuantity(1)
    }
  }

  const handleAddClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!token) return

    try {
      await fetch('/api/cart/recipes/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipe_id: recipeId,
          serving_size: currentQuantity
        })
      })
      await refreshCart()
      setIsAdded(true)
    } catch (error) {
      console.error('Failed to add recipe to cart:', error)
    }
  }

  const handleQuantityChange = async (e: React.MouseEvent, delta: number) => {
    e.stopPropagation()
    const newQuantity = Math.min(3, Math.max(1, currentQuantity + delta))
    setCurrentQuantity(newQuantity)

    // If already in cart, sync change to backend
    if (isAdded && token) {
      try {
        await fetch('/api/cart/recipes/', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            recipe_id: recipeId,
            serving_size: newQuantity
          })
        })
        await refreshCart()
      } catch (err) {
        console.error('Failed to update serving size:', err)
      }
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteDialogOpen(true)
  }

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    setMenuAnchorEl(e.currentTarget)
  }

  const handleMenuClose = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setMenuAnchorEl(null)
  }

  const handleMenuDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuAnchorEl(null)
    setDeleteDialogOpen(true)
  }

  const handleViewSource = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuAnchorEl(null)
    if (sourceUrl) window.open(sourceUrl, '_blank', 'noopener,noreferrer')
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuAnchorEl(null)
    if (!token) return
    try {
      await fetch(`/api/recipes/${recipeId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ favorite: !isFavorite })
      })
      setIsFavorite(prev => !prev)
      if (onRecipeUpdated) onRecipeUpdated()
    } catch (err) {
      console.error('Failed to toggle favorite:', err)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!token) return

    try {
      await fetch(`/api/recipes/${recipeId}/`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setDeleteDialogOpen(false)
      if (onRecipeDeleted) {
        onRecipeDeleted()
      }
    } catch (error) {
      console.error('Failed to delete recipe:', error)
    }
  }

  return (
    <div className={styles.accordion}>
      <button 
        className={`${styles.header} ${isOpen ? styles.headerOpen : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.headerContent}>
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className={`${styles.title} ${styles.titleLink}`}>
              {title}
            </a>
          ) : (
            <span className={styles.title}>{title}</span>
          )}
          <span className={styles.calories}>{calories} cal</span>
          <span className={styles.serves}>Serves {serves}</span>
          <div className={styles.quantitySelector}>
            <div 
              className={styles.quantityButton}
              onClick={(e) => handleQuantityChange(e, -1)}
            >
              -
            </div>
            <span className={styles.quantity}>{currentQuantity}</span>
            <div 
              className={styles.quantityButton}
              onClick={(e) => handleQuantityChange(e, 1)}
            >
              +
            </div>
          </div>
          <div 
            className={`${styles.addButton} ${isAdded ? styles.added : ''}`}
            onClick={handleAddClick}
          >
            {isAdded ? <CheckCircle /> : <AddCircleOutline />}
          </div>
          <div 
            className={styles.deleteButton}
            onClick={handleDeleteClick}
          >
            <Delete />
          </div>
        </div>
        <ExpandMore className={`${styles.arrow} ${isOpen ? styles.open : ''}`} />
      </button>
      {isOpen && (
        <div className={styles.content}>
          <div className={styles.contentMenu} onClick={(e) => e.stopPropagation()}>
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVert />
            </IconButton>
            <Menu
              anchorEl={menuAnchorEl}
              open={Boolean(menuAnchorEl)}
              onClose={handleMenuClose}
              onClick={(e) => e.stopPropagation()}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem onClick={handleToggleFavorite}>{isFavorite ? 'Unfavorite' : 'Favorite'}</MenuItem>
              {sourceUrl && (
                <MenuItem onClick={handleViewSource}>View source</MenuItem>
              )}
              <MenuItem onClick={handleMenuDelete}>Delete recipe</MenuItem>
              <MenuItem onClick={handleMenuClose}>Close</MenuItem>
            </Menu>
          </div>
          {children}
        </div>
      )}
      
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Recipe</DialogTitle>
        <DialogContent>
          Are you sure you want to delete "{title}"? This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default RecipeAccordion
