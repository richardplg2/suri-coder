import { CreateProjectModal } from './create-project-modal'
import { DeleteProjectModal } from './delete-project-modal'

export function ModalProvider() {
  return (
    <>
      <CreateProjectModal />
      <DeleteProjectModal />
    </>
  )
}
