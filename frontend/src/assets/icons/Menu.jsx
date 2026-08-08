import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Menu = forwardRef(function Menu(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M4 5h16" />
      <path d="M4 12h16" />
      <path d="M4 19h16" />
    </CridoraIcon>
  )
})

export default Menu
