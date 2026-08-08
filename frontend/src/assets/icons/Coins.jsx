import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Coins = forwardRef(function Coins(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" />
      <path d="M15 6h1v4" />
      <path d="m6.134 14.768.866-.5 2 3.464" />
      <circle cx="16" cy="8" r="6" />
    </CridoraIcon>
  )
})

export default Coins
