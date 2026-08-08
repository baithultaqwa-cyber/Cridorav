import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const TrendingDown = forwardRef(function TrendingDown(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="M16 17h6v-6" />
      <path d="m22 17-8.5-8.5-5 5L2 7" />
    </CridoraIcon>
  )
})

export default TrendingDown
