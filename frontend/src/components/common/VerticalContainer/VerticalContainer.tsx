import styles from './VerticalContainer.module.css'

interface VerticalContainerProps {
  children: React.ReactNode
}

const VerticalContainer = ({ children }: VerticalContainerProps) => {
  return (
    <div className={styles.container}>
      {children}
    </div>
  )
}

export default VerticalContainer