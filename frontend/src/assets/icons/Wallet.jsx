import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Wallet = forwardRef(function Wallet(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </CridoraIcon>
  )
})

export default Wallet
