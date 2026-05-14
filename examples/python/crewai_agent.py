"""
Neura x CrewAI — Memory Tools Example

Give your CrewAI agent persistent memory and state.

Install:
    pip install neura crewai

Run:
    NEURA_API_KEY=sk-... python crewai_agent.py
"""

import os
from crewai import Agent, Task, Crew
from crewai.tools import tool
from neura import Neura

# Initialize Neura
neura = Neura(api_key=os.environ["NEURA_API_KEY"])

@tool("Remember")
def remember(content: str, tags: list = None, importance: int = 0) -> str:
    """Store a fact, preference, or result in long-term memory.
    
    Args:
        content: The fact or information to remember
        tags: Optional tags like ["preference", "user", "task"]
        importance: Importance 0-10
    """
    mem = neura.memory.create(content=content, tags=tags or [], importance=importance)
    return f'Stored: "{content}" (id: {mem["id"]})'


@tool("Recall")
def recall(query: str, limit: int = 5) -> str:
    """Search your long-term memory for relevant information.
    
    Args:
        query: Natural language query
        limit: Max results
    """
    results = neura.memory.search(query, limit=limit)
    if not results:
        return "No relevant memories found."
    return "\n".join(
        f"[{i+1}] (score: {r.get('score', 0):.2f}) {r['content']}"
        for i, r in enumerate(results)
    )


@tool("Set State")
def set_state(key: str, value) -> str:
    """Store persistent state like goals or settings.
    
    Args:
        key: State key
        value: Any JSON value
    """
    neura.state.set(key, value)
    return f'State "{key}" set.'


@tool("Get State")
def get_state(key: str) -> str:
    """Retrieve a previously stored state value.
    
    Args:
        key: State key
    """
    try:
        entry = neura.state.get(key)
        return str(entry["value"])
    except Exception:
        return f'No state found for key "{key}".'


if __name__ == "__main__":
    # Example: Neura-powered CrewAI agent
    agent = Agent(
        role="Research Agent",
        goal="Research topics and remember findings",
        backstory="You have a Neura-powered external brain for long-term memory.",
        tools=[remember, recall, set_state, get_state],
        verbose=True,
    )

    task = Task(
        description="Research the latest AI agent frameworks and store what you learn.",
        expected_output="Summary of findings stored in memory.",
        agent=agent,
    )

    crew = Crew(agents=[agent], tasks=[task])
    result = crew.kickoff()
    print("\n=== Result ===")
    print(result)
