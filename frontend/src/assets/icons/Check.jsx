import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Check = forwardRef(function Check(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </CridoraIcon>
  )
})

export default Check
