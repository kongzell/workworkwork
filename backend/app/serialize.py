from app.models import Project, Task
from app.schemas import ProjectOut, TaskOut


def task_out(task: Task) -> TaskOut:
    return TaskOut(
        id=task.id,
        number=task.number,
        parent_id=task.parent_id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        position=task.position,
        assignee_ids=[m.id for m in task.assignees],
        category=task.category,
        tags=task.tags or [],
        estimate_hours=task.estimate_hours,
        complexity=task.complexity,
        needs_rework=task.needs_rework,
        rework_count=task.rework_count,
        completed_at=task.completed_at,
        created_at=task.created_at,
        branch=task.branch,
        review_url=task.review_url,
    )


def project_out(project: Project) -> ProjectOut:
    return ProjectOut(
        id=project.id,
        name=project.name,
        github_repo=project.github_repo,
        owner_id=project.owner_id,
        task_prefix=project.task_prefix,
        member_ids=[m.id for m in project.members],
        tasks=[task_out(t) for t in sorted(project.tasks, key=lambda t: t.position)],
    )
