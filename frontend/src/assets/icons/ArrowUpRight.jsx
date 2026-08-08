import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const ArrowUpRight = forwardRef(function ArrowUpRight(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </CridoraIcon>
  )
})

export default ArrowUpRight
