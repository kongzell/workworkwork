from app.models import Project, Task
from app.schemas import ProjectOut, TaskOut


def task_out(task: Task) -> TaskOut:
    return TaskOut(
        id=task.id,
        parent_id=task.parent_id,
        title=task.title,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        position=task.position,
        assignee_ids=[m.id for m in task.assignees],
        category=task.category,
        tags=task.tags or [],
        estimate_hours=task.estimate_hours,
        complexity=task.complexity,
    )


def project_out(project: Project) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        github_repo=project.github_repo,
        member_ids=[m.id for m in project.members],
        tasks=[task_out(t) for t in sorted(project.tasks, key=lambda t: t.position)],
    )
