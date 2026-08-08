import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const CreditCard = forwardRef(function CreditCard(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </CridoraIcon>
  )
})

export default CreditCard
