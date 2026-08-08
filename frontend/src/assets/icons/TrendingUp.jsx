import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const TrendingUp = forwardRef(function TrendingUp(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M16 7h6v6" />
      <path d="m22 7-8.5 8.5-5-5L2 17" />
    </CridoraIcon>
  )
})

export default TrendingUp
