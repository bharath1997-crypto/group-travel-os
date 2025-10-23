import TopicForm from '../components/TopicForm'
import PlanPreview from '../components/PlanPreview'

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="text-center space-y-3">
        <h1 className="text-4xl font-bold">Storyboard</h1>
        <p className="text-gray-600">Type a topic → get a structured comic plan.</p>
      </section>
      <TopicForm />
      <PlanPreview />
    </div>
  )
}
