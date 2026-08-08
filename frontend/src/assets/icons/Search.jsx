import { forwardRef } from 'react'
import CridoraIcon from './_Icon.jsx'

const Search = forwardRef(function Search(props, ref) {
  return (
    <CridoraIcon ref={ref} {...props}>
      <path d="m21 21-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </CridoraIcon>
  )
})

export default Search
