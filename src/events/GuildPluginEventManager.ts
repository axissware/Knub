import { BasePluginEventManager, Listener, OnOpts, WrappedListener } from "./BasePluginEventManager";
import { GuildPluginData } from "..";
import { GuildEvent, GuildEventArguments } from "./eventTypes";
import { FilteredListener, ignoreBots, ignoreSelf, withFilters } from "./eventFilters";
import { AnyGuildEventListenerBlueprint } from "../plugins/PluginBlueprint";
import { RelayListener } from "./EventRelay";

export class GuildPluginEventManager<
  TPluginData extends GuildPluginData<any>
> extends BasePluginEventManager<TPluginData> {
  registerEventListener<T extends AnyGuildEventListenerBlueprint<TPluginData>>(blueprint: T): WrappedListener {
    if (!this.listeners.has(blueprint.event)) {
      this.listeners.set(blueprint.event, new Set());
    }

    const filters = blueprint.filters || [];

    if (!blueprint.allowSelf) {
      filters.unshift(ignoreSelf());
    }

    if (!blueprint.allowBots) {
      filters.unshift(ignoreBots());
    }

    const filteredListener = withFilters(blueprint.event, blueprint.listener, filters) as FilteredListener<
      Listener<TPluginData, T["event"]>
    >;

    const wrappedListener: WrappedListener = (args: GuildEventArguments[T["event"]]) => {
      return filteredListener({
        // @ts-ignore TS is having trouble inferring this correctly. We know TPluginData extends GuildPluginData, which
        // means that args should be GuildEventArguments[T["event"]], which it is as per the type annotation above.
        args,
        pluginData: this.pluginData!,
      });
    };

    this.listeners.get(blueprint.event)!.add(wrappedListener);

    (wrappedListener as RelayListener<any>).profilerContext = this.pluginData!.pluginName;
    this.eventRelay.onGuildEvent(this.pluginData!.guild.id, blueprint.event, wrappedListener);

    return wrappedListener;
  }

  off(event: GuildEvent, listener: WrappedListener): void {
    if (!this.listeners.has(event)) {
      return;
    }

    this.listeners.get(event)!.delete(listener);
    this.eventRelay.offGuildEvent(this.pluginData!.guild.id, event, listener);
  }

  on<TEventName extends GuildEvent>(
    event: TEventName,
    listener: Listener<TPluginData, TEventName>,
    opts?: OnOpts
  ): WrappedListener {
    return this.registerEventListener({
      ...opts,
      event: event as GuildEvent,
      listener,
    } as AnyGuildEventListenerBlueprint<TPluginData>);
  }
}
