import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const ArrowDownRight = forwardRef(function ArrowDownRight(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="m7 7 10 10" />
      <path d="M17 7v10H7" />
    </CridoraIcon>
  )
})

export default ArrowDownRight
