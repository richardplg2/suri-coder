import { CreateProjectModal } from './create-project-modal'
import { CreateTicketModal } from './create-ticket-modal'
import { DeleteProjectModal } from './delete-project-modal'
import { ConnectReposModal } from './connect-repos-modal'

export function ModalProvider() {
  return (
    <>
      <CreateProjectModal />
      <CreateTicketModal />
      <DeleteProjectModal />
      <ConnectReposModal />
    </>
  )
}
