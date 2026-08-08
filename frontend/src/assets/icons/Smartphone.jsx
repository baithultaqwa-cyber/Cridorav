import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Smartphone = forwardRef(function Smartphone(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </CridoraIcon>
  )
})

export default Smartphone
