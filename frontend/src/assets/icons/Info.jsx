import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Info = forwardRef(function Info(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </CridoraIcon>
  )
})

export default Info
