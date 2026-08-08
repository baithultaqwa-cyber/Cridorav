import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Plus = forwardRef(function Plus(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </CridoraIcon>
  )
})

export default Plus
