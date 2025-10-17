import { useState } from 'react'
import { ExpandMore } from '@mui/icons-material'
import styles from './RecipeAccordion.module.css'

interface RecipeAccordionProps {
  title: string
  calories: number
  serves: number
  added: boolean
  quantity: number
  ingredients: string[]
  instructions: string[]
  imageUrl?: string
  children: React.ReactNode
  onAddToCart?: () => void
  onQuantityChange?: (quantity: number) => void
}

const RecipeAccordion = ({ title, calories, serves, added, quantity, ingredients, instructions, imageUrl, children, onAddToCart, onQuantityChange}: RecipeAccordionProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdded, setIsAdded] = useState(added)
  const [currentQuantity, setCurrentQuantity] = useState(quantity)

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsAdded(!isAdded)
    if (!isAdded && onAddToCart) {
      onAddToCart()
    }
  }

  const handleQuantityChange = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation()
    const newQuantity = Math.max(0.5, currentQuantity + delta)
    setCurrentQuantity(newQuantity)
    if (onQuantityChange) {
      onQuantityChange(newQuantity)
    }
  }

  return (
    <div className={styles.accordion}>
      <button 
        className={`${styles.header} ${isOpen ? styles.headerOpen : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.headerContent}>
          <span className={styles.title}>{title}</span>
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
            {isAdded ? '✓' : '+'}
          </button>
        </div>
        <ExpandMore className={`${styles.arrow} ${isOpen ? styles.open : ''}`} />
      </button>
      {isOpen && (
        <div className={styles.content}>
          {children}
        </div>
      )}
    </div>
  )
}

export default RecipeAccordion
