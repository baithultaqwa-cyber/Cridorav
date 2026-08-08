import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Globe = forwardRef(function Globe(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </CridoraIcon>
  )
})

export default Globe
