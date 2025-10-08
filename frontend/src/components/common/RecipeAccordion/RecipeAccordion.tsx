import { useState } from 'react'
import styles from './RecipeAccordion.module.css'

interface RecipeAccordionProps {
  title: string
  calories: number
  serves: number
  added: boolean
  ingredients: string[]
  instructions: string[]
  imageUrl?: string
  children: React.ReactNode
}

const RecipeAccordion = ({ title, calories, serves, added, ingredients, instructions, imageUrl, children}: RecipeAccordionProps) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={styles.accordion}>
      <button 
        className={styles.header} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.headerContent}>
          <span className={styles.title}>{title}</span>
          <span className={styles.calories}>{calories} cal</span>
          <span className={styles.serves}>Serves {serves}</span>
        </div>
        <span className={`${styles.arrow} ${isOpen ? styles.open : ''}`}>\/</span>
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
