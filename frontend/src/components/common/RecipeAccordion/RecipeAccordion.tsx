import React, { useState, useEffect, useRef } from 'react'
import { ExpandMore, Delete, MoreVert, Favorite, FavoriteBorder, Print } from '@mui/icons-material'
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart'
import RemoveShoppingCartIcon from '@mui/icons-material/RemoveShoppingCart'
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
  onRecipeEdit?: (recipeId: number) => void
  initialOpen?: boolean
  variant?: 'expanded' | 'list'
  imageUrl?: string
}

const RecipeAccordion = ({
  recipeId,
  title,
  calories,
  serves,
  children,
  sourceUrl,
  onRecipeDeleted,
  favorite = false,
  onRecipeUpdated,
  onRecipeEdit,
  initialOpen = false,
  variant = 'list',
  imageUrl
}: RecipeAccordionProps) => {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [isAdded, setIsAdded] = useState(false)
  const [currentQuantity, setCurrentQuantity] = useState(1)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [isFavorite, setIsFavorite] = useState<boolean>(favorite)
  const accordionRef = useRef<HTMLDivElement>(null)
  const { token } = useAuth()
  const { cart, refreshCart, removeRecipe } = useCartContext()

  // Scroll to accordion when initially opened
  useEffect(() => {
    if (initialOpen && accordionRef.current) {
      setTimeout(() => {
        accordionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [initialOpen])

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

    // If already in cart, remove it
    if (isAdded) {
      try {
        await removeRecipe(recipeId)
        await refreshCart()
        setIsAdded(false)
      } catch (error) {
        console.error('Failed to remove recipe from cart:', error)
      }
      return
    }

    // Otherwise, add it to cart
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

  const handleMenuClose = () => {
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

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuAnchorEl(null)
    if (onRecipeEdit) onRecipeEdit(recipeId)
  }

  const handlePrint = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuAnchorEl(null)
    if (!token) return

    try {
      const response = await fetch(`/api/recipes/${recipeId}/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const recipe = await response.json()

      const ingredients = recipe.ingredients?.map((ing: any) => 
        ing.original_text || `${ing.quantity} ${ing.unit} ${ing.name}`.trim()
      ) || []
      const instructions = recipe.steps?.sort((a: any, b: any) => a.order - b.order).map((s: any) => s.description) || []

      const printWindow = window.open('', '', 'width=800,height=600')
      if (!printWindow) return

      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { margin-bottom: 10px; }
              .meta { color: #666; margin-bottom: 20px; }
              img { max-width: 300px; height: auto; margin-bottom: 20px; }
              h2 { margin-top: 20px; margin-bottom: 10px; font-size: 18px; }
              ul, ol { margin: 10px 0; padding-left: 25px; }
              li { margin: 8px 0; line-height: 1.5; }
              @media print { body { padding: 10px; } }
            </style>
          </head>
          <body>
            <h1>${title}</h1>
            <div class="meta"><strong>Serves:</strong> ${serves} | <strong>Calories:</strong> ${calories > 0 ? calories + ' cal per serving' : 'N/A'}</div>
            ${imageUrl ? `<img src="${imageUrl}" alt="${title}" />` : ''}
            <h2>Ingredients</h2>
            <ul>${ingredients.map((ing: string) => `<li>${ing}</li>`).join('')}</ul>
            <h2>Directions</h2>
            <ol>${instructions.map((step: string) => `<li>${step}</li>`).join('')}</ol>
          </body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 250)
    } catch (error) {
      console.error('Failed to fetch recipe for printing:', error)
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

  const accordionClassName = `${styles.accordion} ${variant === 'expanded' ? styles.expandedVariant : styles.listVariant}`
  const headerClassName = `${styles.header} ${isOpen ? styles.headerOpen : ''}`

  const rightSideControls = (
    <div className={styles.rightSide}>
      {calories > 0 && <span className={styles.calories}>{calories} cal</span>}
      {serves > 0 && <span className={styles.serves}>Serves {serves}</span>}
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
        {isAdded ? <RemoveShoppingCartIcon /> : <AddShoppingCartIcon />}
      </div>
      <div
        className={`${styles.favoriteButton} ${isFavorite ? styles.active : ''}`}
        onClick={handleToggleFavorite}
      >
        {isFavorite ? <Favorite /> : <FavoriteBorder />}
      </div>
      <IconButton size="small" onClick={handleMenuOpen}>
        <MoreVert />
      </IconButton>
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem onClick={handleToggleFavorite}>{isFavorite ? 'Unfavorite' : 'Favorite'}</MenuItem>
        <MenuItem onClick={handleEditClick}>Edit recipe</MenuItem>
        {sourceUrl && (
          <MenuItem onClick={handleViewSource}>View source</MenuItem>
        )}
        <MenuItem onClick={handlePrint}>Print recipe</MenuItem>
        <MenuItem onClick={handleMenuDelete}>Delete recipe</MenuItem>
        <MenuItem onClick={(e) => { e.stopPropagation(); handleMenuClose(); }}>Close</MenuItem>
      </Menu>
    </div>
  )

  const renderHeaderContent = () => {
    return (
      <div className={styles.headerContent}>
        {variant === 'expanded' && (
          <div className={styles.inlineThumbnail}>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={title} />
            ) : (
              <div className={styles.inlineThumbnailPlaceholder}>No image</div>
            )}
          </div>
        )}
        {sourceUrl ? (
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className={`${styles.title} ${styles.titleLink}`}>
            {title}
          </a>
        ) : (
          <span className={styles.title}>{title}</span>
        )}
        {rightSideControls}
      </div>
    )
  }

  return (
    <div className={accordionClassName} ref={accordionRef}>
      <button
        type="button"
        className={headerClassName}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        {renderHeaderContent()}
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
