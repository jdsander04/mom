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
  sourceUrl?: string
  onRecipeDeleted?: () => void
}

const RecipeAccordion = ({ recipeId, title, calories, serves, children, sourceUrl, onRecipeDeleted }: RecipeAccordionProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const [currentQuantity, setCurrentQuantity] = useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { token } = useAuth()

  useEffect(() => {
    checkRecipeInCart()
  }, [recipeId])

  const checkRecipeInCart = async () => {
    // Since we don't track recipes separately anymore, just reset state
    setIsAdded(false)
    setCurrentQuantity(1)
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
      setIsAdded(true)
    } catch (error) {
      console.error('Failed to add recipe to cart:', error)
    }
  }

  const handleQuantityChange = async (e: React.MouseEvent, delta: number) => {
    e.stopPropagation()
    const newQuantity = Math.max(0.5, currentQuantity + delta)
    setCurrentQuantity(newQuantity)
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
            <div 
              className={styles.quantityButton}
              onClick={(e) => handleQuantityChange(e, -0.5)}
            >
              -
            </div>
            <span className={styles.quantity}>{currentQuantity}</span>
            <div 
              className={styles.quantityButton}
              onClick={(e) => handleQuantityChange(e, 0.5)}
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
