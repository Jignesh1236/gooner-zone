import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  View,
  Modal,
  Pressable,
  FlatList,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { mangadexApi, MangaTag, SearchFilters, SortOption } from "@/services/mangadex";

interface SearchFiltersModalProps {
  visible: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
}

const STATUS_OPTIONS = [
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "hiatus", label: "Hiatus" },
  { value: "cancelled", label: "Cancelled" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "latestUploadedChapter", label: "Latest Upload" },
  { value: "followedCount", label: "Popularity" },
  { value: "createdAt", label: "Newest Added" },
  { value: "rating", label: "Rating" },
];

type TagMode = "include" | "exclude" | "none";

export function SearchFiltersModal({
  visible,
  onClose,
  filters,
  onApply,
}: SearchFiltersModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [allTags, setAllTags] = useState<MangaTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string[]>(filters.status);
  const [sortBy, setSortBy] = useState<SortOption>(filters.sortBy);
  const [includedTags, setIncludedTags] = useState<string[]>(filters.includedTags);
  const [excludedTags, setExcludedTags] = useState<string[]>(filters.excludedTags);
  const [activeSection, setActiveSection] = useState<"status" | "sort" | "tags">("tags");
  const [tagFilter, setTagFilter] = useState("");

  useEffect(() => {
    if (visible) {
      setSelectedStatus(filters.status);
      setSortBy(filters.sortBy);
      setIncludedTags(filters.includedTags);
      setExcludedTags(filters.excludedTags);
      loadTags();
    }
  }, [visible, filters]);

  const loadTags = async () => {
    setLoadingTags(true);
    const tags = await mangadexApi.getTags();
    setAllTags(tags);
    setLoadingTags(false);
  };

  const groupedTags = useMemo(() => {
    const groups: Record<string, MangaTag[]> = {
      genre: [],
      theme: [],
      format: [],
      content: [],
    };
    
    allTags.forEach(tag => {
      if (groups[tag.group]) {
        groups[tag.group].push(tag);
      }
    });
    
    return groups;
  }, [allTags]);

  const filteredTags = useMemo(() => {
    if (!tagFilter) return allTags;
    const lowerFilter = tagFilter.toLowerCase();
    return allTags.filter(tag => tag.name.toLowerCase().includes(lowerFilter));
  }, [allTags, tagFilter]);

  const getTagMode = (tagId: string): TagMode => {
    if (includedTags.includes(tagId)) return "include";
    if (excludedTags.includes(tagId)) return "exclude";
    return "none";
  };

  const cycleTagMode = (tagId: string) => {
    const currentMode = getTagMode(tagId);
    
    if (currentMode === "none") {
      setIncludedTags([...includedTags, tagId]);
    } else if (currentMode === "include") {
      setIncludedTags(includedTags.filter(id => id !== tagId));
      setExcludedTags([...excludedTags, tagId]);
    } else {
      setExcludedTags(excludedTags.filter(id => id !== tagId));
    }
  };

  const toggleStatus = (status: string) => {
    if (selectedStatus.includes(status)) {
      setSelectedStatus(selectedStatus.filter(s => s !== status));
    } else {
      setSelectedStatus([...selectedStatus, status]);
    }
  };

  const handleApply = () => {
    onApply({
      status: selectedStatus,
      sortBy,
      includedTags,
      excludedTags,
    });
    onClose();
  };

  const handleReset = () => {
    const resetFilters = {
      status: [],
      sortBy: "followedCount" as const,
      includedTags: [],
      excludedTags: [],
    };
    setSelectedStatus([]);
    setSortBy("followedCount");
    setIncludedTags([]);
    setExcludedTags([]);
    onApply(resetFilters);
    onClose();
  };

  const activeFiltersCount = 
    selectedStatus.length + 
    includedTags.length + 
    excludedTags.length + 
    (sortBy !== "relevance" ? 1 : 0);

  const renderTagItem = ({ item }: { item: MangaTag }) => {
    const mode = getTagMode(item.id);
    
    let bgColor = theme.backgroundSecondary;
    let textColor = theme.text;
    let icon: "plus" | "minus" | "circle" = "circle";
    
    if (mode === "include") {
      bgColor = theme.primary;
      textColor = "#FFFFFF";
      icon = "plus";
    } else if (mode === "exclude") {
      bgColor = "#FF6B6B";
      textColor = "#FFFFFF";
      icon = "minus";
    }

    return (
      <Pressable
        onPress={() => cycleTagMode(item.id)}
        style={[styles.tagChip, { backgroundColor: bgColor }]}
      >
        {mode !== "none" && (
          <Feather name={icon} size={12} color={textColor} style={{ marginRight: 4 }} />
        )}
        <ThemedText type="caption" style={{ color: textColor }}>
          {item.name}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h2">Filters</ThemedText>
          <Pressable onPress={handleReset} style={styles.resetBtn}>
            <ThemedText type="small" style={{ color: theme.primary }}>
              Reset
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.sectionTabs}>
          {["tags", "status", "sort"].map((section) => (
            <Pressable
              key={section}
              onPress={() => setActiveSection(section as typeof activeSection)}
              style={[
                styles.sectionTab,
                activeSection === section && { borderBottomColor: theme.primary, borderBottomWidth: 2 },
              ]}
            >
              <ThemedText
                type="body"
                style={{ 
                  color: activeSection === section ? theme.primary : theme.textSecondary,
                  fontWeight: activeSection === section ? "600" : "400",
                }}
              >
                {section.charAt(0).toUpperCase() + section.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {activeSection === "sort" && (
            <View style={styles.sectionContent}>
              <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                SORT BY
              </ThemedText>
              {SORT_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setSortBy(option.value)}
                  style={[
                    styles.optionRow,
                    { backgroundColor: theme.backgroundDefault },
                  ]}
                >
                  <ThemedText type="body">{option.label}</ThemedText>
                  {sortBy === option.value && (
                    <Feather name="check" size={20} color={theme.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {activeSection === "status" && (
            <View style={styles.sectionContent}>
              <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                PUBLICATION STATUS
              </ThemedText>
              {STATUS_OPTIONS.map((option) => {
                const isSelected = selectedStatus.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => toggleStatus(option.value)}
                    style={[
                      styles.optionRow,
                      { backgroundColor: theme.backgroundDefault },
                    ]}
                  >
                    <View style={styles.checkboxRow}>
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor: isSelected ? theme.primary : theme.textSecondary,
                            backgroundColor: isSelected ? theme.primary : "transparent",
                          },
                        ]}
                      >
                        {isSelected && (
                          <Feather name="check" size={12} color="#FFFFFF" />
                        )}
                      </View>
                      <ThemedText type="body">{option.label}</ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          {activeSection === "tags" && (
            <View style={styles.sectionContent}>
              <ThemedText type="caption" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                TAGS (Tap to include, tap again to exclude)
              </ThemedText>
              
              {(includedTags.length > 0 || excludedTags.length > 0) && (
                <View style={styles.selectedTagsContainer}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                    Selected: {includedTags.length} included, {excludedTags.length} excluded
                  </ThemedText>
                </View>
              )}

              {loadingTags ? (
                <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", padding: Spacing.xl }}>
                  Loading tags...
                </ThemedText>
              ) : (
                Object.entries(groupedTags).map(([group, tags]) => {
                  if (tags.length === 0) return null;
                  return (
                    <View key={group} style={styles.tagGroup}>
                      <ThemedText type="small" style={[styles.tagGroupTitle, { color: theme.textSecondary }]}>
                        {group.toUpperCase()}
                      </ThemedText>
                      <View style={styles.tagsGrid}>
                        {tags.map((tag) => (
                          <View key={tag.id}>
                            {renderTagItem({ item: tag })}
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
          <Pressable
            onPress={handleApply}
            style={[styles.applyButton, { backgroundColor: theme.primary }]}
          >
            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Apply Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ""}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  closeBtn: {
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  resetBtn: {
    padding: Spacing.sm,
  },
  sectionTabs: {
    flexDirection: "row",
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(150, 150, 150, 0.2)",
  },
  sectionTab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.xl,
    paddingBottom: 100,
  },
  sectionContent: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    letterSpacing: 1,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedTagsContainer: {
    marginBottom: Spacing.sm,
  },
  tagGroup: {
    marginBottom: Spacing.lg,
  },
  tagGroupTitle: {
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
  },
  tagsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.xl,
    paddingTop: Spacing.md,
  },
  applyButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
});
