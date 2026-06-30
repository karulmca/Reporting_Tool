import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Avatar, StatusBadge, Empty, Modal, Field } from './ui'

const members = [{ id: '1', name: 'Arul Kuppusamy' }]

describe('Avatar', () => {
  it('renders initials', () => {
    render(<Avatar members={members} name="Arul Kuppusamy" />)
    expect(screen.getByText('AK')).toBeInTheDocument()
  })
})

describe('StatusBadge', () => {
  it('shows the status text with a status class', () => {
    render(<StatusBadge status="Implemented" />)
    const el = screen.getByText('Implemented')
    expect(el).toHaveClass('badge', 'bg')
  })
})

describe('Empty', () => {
  it('renders its children', () => {
    render(<Empty>Nothing here</Empty>)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })
})

describe('Field', () => {
  it('renders a label and its child input', () => {
    render(<Field label="POD Code"><input placeholder="code" /></Field>)
    expect(screen.getByText('POD Code')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('code')).toBeInTheDocument()
  })
})

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<Modal open={false} title="Hidden" onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('renders title, body and footer when open', () => {
    render(
      <Modal open title="My Modal" onClose={() => {}} footer={<button>OK</button>}>
        <p>body text</p>
      </Modal>,
    )
    expect(screen.getByText('My Modal')).toBeInTheDocument()
    expect(screen.getByText('body text')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument()
  })
  it('closes when the overlay is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<Modal open title="X" onClose={onClose}><p>b</p></Modal>)
    // The overlay is the outermost .ov element.
    fireEvent.mouseDown(container.querySelector('.ov'))
    expect(onClose).toHaveBeenCalled()
  })
})
