import { useEffect, useState, useRef } from 'react';
import { Todo } from './types/Todo';
import * as todoService from './api/todos';
import Footer from './components/Footer/Footer';
import Header from './components/Header/Header';
import Error from './components/Error/Error';
import TodoList from './components/TodoList/TodoList';
import { FilterTypes } from './types/FilterTypes';
import Filters from './constants/Filter';
import { ErrorMessage } from './constants/ErrorMessage';
import TodoItem from './components/TodoItem/TodoItem';

export const App = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTodoIds, setLoadingTodoIds] = useState<number[]>([]);
  const [error, setError] = useState<ErrorMessage>(ErrorMessage.EMPTY);
  const [filter, setFilter] = useState<FilterTypes>(Filters[0].value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevTodosLengthRef = useRef(todos.length);

  const showError = (message: ErrorMessage) => {
    setError(message);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setError(ErrorMessage.EMPTY);
      timeoutRef.current = null;
    }, 3000);
  };

  const clearError = () => {
    setError(ErrorMessage.EMPTY);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    const loadTodos = async () => {
      setLoading(true);
      try {
        const todosFromServer = await todoService.getTodos();

        setTodos(todosFromServer);
      } catch {
        showError(ErrorMessage.LOAD);
      } finally {
        setLoading(false);
      }
    };

    loadTodos();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleAddTodo = async (title: string) => {
    const trimmed = title.trim();
    const tempId = -Date.now();

    if (!trimmed) {
      showError(ErrorMessage.EMPTY_TITLE);

      return false;
    }

    const newTempTodo: Todo = {
      id: tempId,
      title: trimmed,
      completed: false,
      userId: todoService.USER_ID,
    };

    setTempTodo(newTempTodo);

    try {
      const newTodo = await todoService.addTodo({
        title: trimmed,
        completed: false,
      });

      setTodos(prev => [...prev, newTodo]);
      setTempTodo(null);

      return true;
    } catch {
      showError(ErrorMessage.ADD);
      setTempTodo(null);

      return false;
    }
  };

  const handleToggleAll = async () => {
    const allCompleted = todos.every(todo => todo.completed);

    const currentTodoIds = todos.map(todo => todo.id);

    setLoadingTodoIds(prev => [...prev, ...currentTodoIds]);

    try {
      const updatedTodos = await Promise.all(
        todos.map(todo =>
          todoService.updateTodo(todo.id, {
            ...todo,
            completed: !allCompleted,
          }),
        ),
      );

      setTodos(updatedTodos);
    } catch {
      showError(ErrorMessage.UPDATE);
    } finally {
      setLoadingTodoIds(prev =>
        prev.filter(id => !currentTodoIds.includes(id)),
      );
    }
  };

  const handleToggle = async (id: number) => {
    setLoadingTodoIds(prev => [...prev, id]);
    try {
      const todoToUpdate = todos.find(todo => todo.id === id);

      if (!todoToUpdate) {
        return;
      }

      const updatedTodo = {
        ...todoToUpdate,
        completed: !todoToUpdate.completed,
      };
      const newTodo = await todoService.updateTodo(id, updatedTodo);

      setTodos(current =>
        current.map(todo => (todo.id === id ? newTodo : todo)),
      );
    } catch {
      showError(ErrorMessage.UPDATE);
    } finally {
      setLoadingTodoIds(prev => prev.filter(todoId => todoId !== id));
    }
  };

  const handleDelete = async (id: number) => {
    setLoadingTodoIds(prev => [...prev, id]);
    try {
      await todoService.deleteTodo(id);
      setTodos(current => current.filter(todo => todo.id !== id));
    } catch {
      showError(ErrorMessage.DELETE);
    } finally {
      setLoadingTodoIds(prev => prev.filter(todoId => todoId !== id));
    }
  };

  const handleUpdate = async (id: number, newTitle: string) => {
    setLoadingTodoIds(prev => [...prev, id]);
    try {
      const todoToUpdate = todos.find(todo => todo.id === id);

      if (!todoToUpdate) {
        return;
      }

      const updatedTodo = { ...todoToUpdate, title: newTitle };
      const newTodo = await todoService.updateTodo(id, updatedTodo);

      setTodos(current =>
        current.map(todo => (todo.id === id ? newTodo : todo)),
      );
    } catch {
      showError(ErrorMessage.UPDATE);
    } finally {
      setLoadingTodoIds(prev => prev.filter(todoId => todoId !== id));
    }
  };

  const handleClearCompleted = async () => {
    const completedTodos = todos.filter(todo => todo.completed);
    const completedIds = completedTodos.map(todo => todo.id);

    setLoadingTodoIds(prev => [...prev, ...completedIds]);

    try {
      await Promise.all(
        completedTodos.map(todo => todoService.deleteTodo(todo.id)),
      );

      setTodos(prev => prev.filter(todo => !todo.completed));
    } catch {
      showError(ErrorMessage.UPDATE);
    } finally {
      setLoadingTodoIds(prev => prev.filter(id => !completedIds.includes(id)));
    }
  };

  // const filteredTodos = todos.filter(todo => {
  //   if (filter === '') {
  //     return true;
  //   }

  //   if (filter === 'active') {
  //     return !todo.completed;
  //   }

  //   if (filter === 'completed') {
  //     return todo.completed;
  //   }

  //   return true;
  // });

  const filteredTodos = todos.filter(todo => {
    switch (filter) {
      case 'active':
        return !todo.completed;
      case 'completed':
        return todo.completed;
      default:
        return true;
    }
  });

  const activeTodos = todos.filter(todo => !todo.completed).length;
  const allCompleted = todos.length > 0 && todos.every(todo => todo.completed);
  const isInputDisabled = tempTodo !== null;

  useEffect(() => {
    if (!tempTodo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [tempTodo]);

  useEffect(() => {
    if (todos.length < prevTodosLengthRef.current) {
      inputRef.current?.focus();
    }

    prevTodosLengthRef.current = todos.length;
  }, [todos]);

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <Header
          onAddTodo={handleAddTodo}
          allCompleted={allCompleted}
          onToggleAll={handleToggleAll}
          isInputDisabled={isInputDisabled}
          inputRef={inputRef}
        />

        <div
          data-cy="TodoLoader"
          className={`modal overlay ${loading ? 'is-active' : ''}`}
        >
          <div className="modal-background has-background-white-ter" />
          <div className="loader" />
        </div>

        <TodoList
          todos={filteredTodos}
          loadingTodoIds={loadingTodoIds}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />

        {tempTodo && (
          <TodoItem
            key={tempTodo.id}
            completed={tempTodo.completed}
            title={tempTodo.title}
            id={tempTodo.id}
            loading={true}
            onToggle={() => {}}
            onDelete={() => {}}
            onUpdate={() => {}}
          />
        )}
        {todos.length > 0 && (
          <Footer
            todos={todos}
            activeTodos={activeTodos}
            filter={filter}
            setFilterBy={setFilter}
            onClearCompleted={handleClearCompleted}
          />
        )}
      </div>

      <Error errorMessage={error} hideError={clearError} />
    </div>
  );
};
