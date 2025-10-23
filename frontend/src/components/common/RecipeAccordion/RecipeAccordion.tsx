import { useState, useEffect } from 'react'
import { ExpandMore, CheckCircle, AddCircleOutline, Delete } from '@mui/icons-material'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import { useAuth } from '../../../contexts/AuthContext'
import styles from './RecipeAccordion.module.css'

interface RecipeAccordionProps {
  recipeId: number
  title: string
  calories: number
  serves: number
  children: React.ReactNode
  cartId?: number
  sourceUrl?: string
  onRecipeDeleted?: () => void
}

const RecipeAccordion = ({ recipeId, title, calories, serves, children, cartId, sourceUrl, onRecipeDeleted }: RecipeAccordionProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const [currentQuantity, setCurrentQuantity] = useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { token } = useAuth()

  useEffect(() => {
    if (cartId) {
      checkRecipeInCart()
    }
  }, [cartId, recipeId])

  const checkRecipeInCart = async () => {
    if (!cartId || !token) return
    
    try {
      const response = await fetch(`/api/carts/${cartId}/recipes/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        const recipe = data.recipes.find((r: any) => r.recipe_id === recipeId)
        if (recipe) {
          setIsAdded(true)
          setCurrentQuantity(recipe.quantity)
        } else {
          setIsAdded(false)
          setCurrentQuantity(1)
        }
      }
    } catch (error) {
      console.error('Failed to check recipe in cart:', error)
    }
  }

  const handleAddClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!cartId || !token) return

    try {
      if (isAdded) {
        // DELETE - remove from cart
        await fetch(`/api/carts/${cartId}/recipes/${recipeId}/`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
        setIsAdded(false)
        setCurrentQuantity(1)
      } else {
        // POST - add to cart
        await fetch(`/api/carts/${cartId}/recipes/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            recipe_id: recipeId,
            quantity: currentQuantity
          })
        })
        setIsAdded(true)
      }
    } catch (error) {
      console.error('Failed to update cart:', error)
    }
  }

  const handleQuantityChange = async (e: React.MouseEvent, delta: number) => {
    e.stopPropagation()
    if (!cartId || !token) return

    const newQuantity = Math.max(0.5, currentQuantity + delta)
    setCurrentQuantity(newQuantity)

    try {
      if (isAdded) {
        if (newQuantity === 0) {
          // DELETE - remove from cart when quantity becomes 0
          await fetch(`/api/carts/${cartId}/recipes/${recipeId}/`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          })
          setIsAdded(false)
          setCurrentQuantity(1)
        } else {
          // PATCH - update quantity
          await fetch(`/api/carts/${cartId}/recipes/${recipeId}/`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ quantity: newQuantity })
          })
        }
      } else if (newQuantity !== 1) {
        // POST - add to cart with non-1 quantity
        await fetch(`/api/carts/${cartId}/recipes/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            recipe_id: recipeId,
            quantity: newQuantity
          })
        })
        setIsAdded(true)
      }
    } catch (error) {
      console.error('Failed to update quantity:', error)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteDialogOpen(true)
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
            <button 
              className={styles.quantityButton}
              onClick={(e) => handleQuantityChange(e, -0.5)}
            >
              -
            </button>
            <span className={styles.quantity}>{currentQuantity}</span>
            <button 
              className={styles.quantityButton}
              onClick={(e) => handleQuantityChange(e, 0.5)}
            >
              +
            </button>
          </div>
          <button 
            className={`${styles.addButton} ${isAdded ? styles.added : ''}`}
            onClick={handleAddClick}
          >
            {isAdded ? <CheckCircle /> : <AddCircleOutline />}
          </button>
          <button 
            className={styles.deleteButton}
            onClick={handleDeleteClick}
          >
            <Delete />
          </button>
        </div>
        <ExpandMore className={`${styles.arrow} ${isOpen ? styles.open : ''}`} />
      </button>
      {isOpen && (
        <div className={styles.content}>
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
